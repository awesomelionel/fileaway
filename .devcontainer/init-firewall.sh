#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support (idempotent on restart)
ipset create -exist allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add -exist allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Pull project-specific Convex / PostHog hostnames out of .env.local so the
# allowlist stays in sync if the deployment name changes.
EXTRA_DOMAINS=()
ENV_FILE="/workspace/.env.local"
if [ -f "$ENV_FILE" ]; then
    extract_host() {
        # Strip scheme, path, and trailing whitespace/quotes from a URL.
        grep -E "^$1=" "$ENV_FILE" \
            | head -n1 \
            | sed -E "s/^$1=//; s|^https?://||; s|/.*$||; s/[\"' ]//g" \
            || true
    }

    for var in \
        NEXT_PUBLIC_CONVEX_URL \
        NEXT_PUBLIC_CONVEX_SITE_URL \
        NEXT_PUBLIC_POSTHOG_HOST; do
        host=$(extract_host "$var")
        if [ -n "$host" ]; then
            echo "Adding env-derived host from $var: $host"
            EXTRA_DOMAINS+=("$host")
        fi
    done
fi

# Resolve and add other allowed domains
#
# Notes on this allowlist (fileaway specific):
#   - registry.npmjs.org             : npm package installs
#   - api.anthropic.com              : Claude Code CLI
#   - sentry.io                      : error reporting (Claude / libs)
#   - statsig.anthropic.com/.com     : Claude feature flags / telemetry
#   - *.code.visualstudio.com etc.   : VS Code dev container extensions
#   - provision.convex.dev           : `npx convex dev` provisioning
#   - api.convex.dev / dashboard...  : Convex CLI + dashboard
#   - <deployment>.convex.cloud/.site: pulled dynamically from .env.local above
#   - generativelanguage.googleapis.com : Google Gemini API
#   - maps.googleapis.com            : Google Maps + Geocoding APIs
#   - fonts.googleapis.com / fonts.gstatic.com : next/font/google (Syne) used in layout.tsx
#   - api.apify.com                  : Apify TikTok / Instagram scrapers
#   - *.posthog.com                  : PostHog analytics (host also pulled from env)
#   - vercel.com / vitals.vercel-insights.com : Vercel analytics + speed insights
#   - s3.amazonaws.com               : @aws-sdk/client-s3 default endpoint
#
# NOTE: Bucket-specific S3 endpoints look like `<bucket>.s3.<region>.amazonaws.com`
# and resolve to different IPs than the global `s3.amazonaws.com`. If the app
# talks to a specific bucket, add that hostname here too.
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "sentry.io" \
    "statsig.anthropic.com" \
    "statsig.com" \
    "marketplace.visualstudio.com" \
    "vscode.blob.core.windows.net" \
    "update.code.visualstudio.com" \
    "provision.convex.dev" \
    "api.convex.dev" \
    "dashboard.convex.dev" \
    "generativelanguage.googleapis.com" \
    "maps.googleapis.com" \
    "fonts.googleapis.com" \
    "fonts.gstatic.com" \
    "api.apify.com" \
    "app.posthog.com" \
    "us.i.posthog.com" \
    "us-assets.i.posthog.com" \
    "vitals.vercel-insights.com" \
    "vercel.com" \
    "s3.amazonaws.com" \
    ${EXTRA_DOMAINS[@]+"${EXTRA_DOMAINS[@]}"}; do
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "WARNING: Failed to resolve $domain — skipping (re-run init-firewall.sh later if traffic is blocked)"
        continue
    fi

    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "WARNING: Invalid IP from DNS for $domain: $ip — skipping this IP"
            continue
        fi
        echo "Adding $ip for $domain"
        ipset add -exist allowed-domains "$ip"
    done < <(echo "$ips")
done

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# Set up remaining iptables rules
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Set default policies to DROP first
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# First allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Then allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi