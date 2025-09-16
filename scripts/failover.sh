#!/bin/bash

# Automated failover script for secure chat application
# This script monitors the main API server and switches to backup servers when needed

MAIN_API="api.domain.com"
BACKUP_SERVERS=(
    "api-backup-1.domain.com"
    "api-backup-2.domain.com"
)

ENDPOINTS=(
    "auth/login"
    "messages/rooms"
    "users/profile"
    "monitoring/health"
)

HEALTH_CHECK_TIMEOUT=10
MAX_CONSECUTIVE_FAILURES=3
NOTIFICATION_EMAIL="admin@domain.com"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL}"

# Log file
LOG_FILE="/var/log/failover.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_endpoint() {
    local server=$1
    local endpoint=$2
    local url="https://$server/api/$endpoint"
    
    response=$(curl -sL -w "%{http_code}" "$url" -o /dev/null --max-time $HEALTH_CHECK_TIMEOUT)
    return $response
}

send_notification() {
    local message=$1
    local severity=$2
    
    # Send email notification
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "[$severity] API Failover Alert" "$NOTIFICATION_EMAIL"
    fi
    
    # Send Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$severity] $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

update_dns_record() {
    local new_server=$1
    
    log "Updating DNS record to point to $new_server"
    
    # AWS Route 53 DNS update (requires AWS CLI configured)
    if command -v aws &> /dev/null; then
        aws route53 change-resource-record-sets \
            --hosted-zone-id "${HOSTED_ZONE_ID}" \
            --change-batch "{
                \"Changes\": [{
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"$MAIN_API\",
                        \"Type\": \"A\",
                        \"TTL\": 60,
                        \"ResourceRecords\": [{\"Value\": \"$new_server\"}]
                    }
                }]
            }"
    fi
}

check_main_server() {
    local failures=0
    
    for endpoint in "${ENDPOINTS[@]}"; do
        check_endpoint "$MAIN_API" "$endpoint"
        local status=$?
        
        if [ $status -ne 200 ]; then
            failures=$((failures + 1))
            log "Health check failed for $MAIN_API/$endpoint (HTTP $status)"
        fi
    done
    
    if [ $failures -gt 0 ]; then
        log "Main server health check failed ($failures/${#ENDPOINTS[@]} endpoints)"
        return $failures
    else
        log "Main server health check passed"
        return 0
    fi
}

find_healthy_backup() {
    for backup in "${BACKUP_SERVERS[@]}"; do
        local backup_failures=0
        
        for endpoint in "${ENDPOINTS[@]}"; do
            check_endpoint "$backup" "$endpoint"
            if [ $? -ne 200 ]; then
                backup_failures=$((backup_failures + 1))
            fi
        done
        
        if [ $backup_failures -eq 0 ]; then
            echo "$backup"
            return 0
        fi
    done
    
    return 1
}

main() {
    log "Starting health check for $MAIN_API"
    
    check_main_server
    main_status=$?
    
    if [ $main_status -gt 0 ]; then
        log "Main server is unhealthy, looking for backup server"
        
        healthy_backup=$(find_healthy_backup)
        if [ $? -eq 0 ]; then
            log "Found healthy backup server: $healthy_backup"
            
            # Update DNS to point to backup
            update_dns_record "$healthy_backup"
            
            # Send notification
            send_notification "Failover executed: Switched from $MAIN_API to $healthy_backup" "CRITICAL"
            
            # Wait and check if main server recovers
            sleep 300  # Wait 5 minutes
            
            check_main_server
            if [ $? -eq 0 ]; then
                log "Main server has recovered, switching back"
                update_dns_record "$MAIN_API"
                send_notification "Main server recovered: Switched back to $MAIN_API" "INFO"
            fi
        else
            log "No healthy backup servers found!"
            send_notification "CRITICAL: All servers are down!" "CRITICAL"
        fi
    fi
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Run the main function
main