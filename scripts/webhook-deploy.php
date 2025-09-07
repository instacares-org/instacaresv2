<?php
/**
 * InstaCares GitHub Webhook Deployment Script
 * 
 * This PHP script can be triggered by GitHub webhooks to automatically
 * deploy your application when code is pushed to the main branch.
 * 
 * Setup Instructions:
 * 1. Upload this file to your Hostinger public_html directory
 * 2. Configure GitHub webhook to point to: https://yourdomain.com/webhook-deploy.php
 * 3. Set a secret in GitHub webhook settings
 * 4. Update the SECRET constant below with the same secret
 */

// Configuration
const SECRET = 'your-webhook-secret-here'; // Change this to match your GitHub webhook secret
const DEPLOY_SCRIPT = '/var/www/instacares/scripts/auto-deploy-hostinger.sh';
const LOG_FILE = '/var/log/webhook-deploy.log';
const ALLOWED_BRANCH = 'main';

// Logging function
function log_message($message) {
    $timestamp = date('Y-m-d H:i:s');
    $log_entry = "[{$timestamp}] {$message}" . PHP_EOL;
    file_put_contents(LOG_FILE, $log_entry, FILE_APPEND | LOCK_EX);
    echo $log_entry;
}

// Verify GitHub signature
function verify_signature($payload, $signature) {
    $expected_signature = 'sha256=' . hash_hmac('sha256', $payload, SECRET);
    return hash_equals($expected_signature, $signature);
}

// Main webhook handler
function handle_webhook() {
    log_message("Webhook received from IP: " . $_SERVER['REMOTE_ADDR']);
    
    // Get raw POST data
    $payload = file_get_contents('php://input');
    
    // Verify signature if secret is set
    if (SECRET !== 'your-webhook-secret-here') {
        $signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
        if (!verify_signature($payload, $signature)) {
            log_message("ERROR: Invalid signature");
            http_response_code(401);
            echo "Unauthorized";
            return;
        }
    }
    
    // Parse JSON payload
    $data = json_decode($payload, true);
    if (!$data) {
        log_message("ERROR: Invalid JSON payload");
        http_response_code(400);
        echo "Bad Request";
        return;
    }
    
    // Check if it's a push event to the correct branch
    if (!isset($data['ref'])) {
        log_message("INFO: Not a push event, ignoring");
        echo "Not a push event";
        return;
    }
    
    $branch = str_replace('refs/heads/', '', $data['ref']);
    if ($branch !== ALLOWED_BRANCH) {
        log_message("INFO: Push to {$branch}, ignoring (only {ALLOWED_BRANCH} triggers deployment)");
        echo "Wrong branch";
        return;
    }
    
    // Log commit information
    if (isset($data['head_commit'])) {
        $commit = $data['head_commit'];
        $commit_msg = $commit['message'] ?? 'No message';
        $commit_id = substr($commit['id'] ?? 'unknown', 0, 7);
        $author = $commit['author']['name'] ?? 'Unknown';
        
        log_message("Push to {$branch} by {$author}: {$commit_id} - {$commit_msg}");
    }
    
    // Execute deployment script
    log_message("Starting automated deployment...");
    
    $output = [];
    $return_code = 0;
    
    // Run deployment script in background
    $command = "sudo bash " . DEPLOY_SCRIPT . " --force 2>&1 &";
    exec($command, $output, $return_code);
    
    if ($return_code === 0) {
        log_message("Deployment script executed successfully");
        echo "Deployment started successfully";
    } else {
        log_message("ERROR: Deployment script failed with code: {$return_code}");
        log_message("Output: " . implode("\n", $output));
        http_response_code(500);
        echo "Deployment failed";
    }
}

// Handle different request methods
switch ($_SERVER['REQUEST_METHOD']) {
    case 'POST':
        handle_webhook();
        break;
    
    case 'GET':
        // Simple status check
        echo "InstaCares Webhook Handler\n";
        echo "Status: Active\n";
        echo "Listening for: push events to " . ALLOWED_BRANCH . " branch\n";
        echo "Last deployment: " . (file_exists(LOG_FILE) ? date('Y-m-d H:i:s', filemtime(LOG_FILE)) : 'Never') . "\n";
        break;
    
    default:
        http_response_code(405);
        echo "Method Not Allowed";
        break;
}
?>