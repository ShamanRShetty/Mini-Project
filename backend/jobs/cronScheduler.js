/**
 * Cron Job Scheduler
 * 
 * Runs vulnerability score updates daily at midnight
 * Usage: Import and call initCronJobs() in server.js
 */

const cron = require('node-cron');
const VulnerabilityService = require('../services/vulnerabilityService');

class CronScheduler {
  
  /**
   * Initialize all cron jobs
   */
  static initCronJobs() {
    console.log('[CRON] Initializing scheduled jobs...');
    
    // Daily vulnerability score update (runs at midnight)
    this.scheduleVulnerabilityUpdate();
    
    // Hourly urgent case check (runs every hour)
    this.scheduleUrgentCaseCheck();
    
    console.log('[CRON] All jobs scheduled successfully');
  }
  
  /**
   * Schedule daily vulnerability score update
   * Runs every day at midnight (00:00)
   */
  static scheduleVulnerabilityUpdate() {
    // Cron pattern: minute hour day month weekday
    // '0 0 * * *' = Every day at 00:00 (midnight)
    
    cron.schedule('0 0 * * *', async () => {
      console.log('\n========================================');
      console.log('[CRON] Starting daily vulnerability score update');
      console.log(`Time: ${new Date().toISOString()}`);
      console.log('========================================\n');
      
      try {
        const results = await VulnerabilityService.updateAllScores();
        
        console.log('\n[CRON] Daily update completed:');
        console.log(`  ✅ Updated: ${results.updated} beneficiaries`);
        console.log(`  ⚠️  Escalated: ${results.escalated.length} cases`);
        console.log(`  ❌ Errors: ${results.errors.length}`);
        console.log(`  ⏱️  Duration: ${results.duration}s`);
        
        // Send alerts for escalations
        if (results.escalated.length > 0) {
          await VulnerabilityService.sendEscalationAlerts(results.escalated);
        }
        
      } catch (err) {
        console.error('[CRON] Daily update failed:', err);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // Adjust to your timezone
    });
    
    console.log('[CRON] ✓ Daily vulnerability update scheduled (00:00)');
  }
  
  /**
   * Schedule hourly urgent case check
   * Runs every hour to monitor critical cases
   */
  static scheduleUrgentCaseCheck() {
    // '0 * * * *' = Every hour at minute 0
    
    cron.schedule('0 * * * *', async () => {
      try {
        const urgent = await VulnerabilityService.getUrgentCases();
        
        if (urgent.length > 0) {
          console.log(`\n[CRON] ⚠️  ${urgent.length} URGENT CASES REQUIRE ATTENTION`);
          
          urgent.forEach(ben => {
            const overdue = ben.estimatedDelivery < new Date();
            const status = overdue ? '🔴 OVERDUE' : '🟠 CRITICAL';
            console.log(`  ${status} ${ben.name} (Score: ${ben.vulnerabilityScore})`);
          });
        }
      } catch (err) {
        console.error('[CRON] Urgent case check failed:', err);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    console.log('[CRON] ✓ Hourly urgent case check scheduled');
  }
  
  /**
   * Manual trigger for testing (optional)
   */
  static async runNow() {
    console.log('[CRON] Manual trigger - running vulnerability update now...');
    
    try {
      const results = await VulnerabilityService.updateAllScores();
      console.log('[CRON] Manual update completed:', results);
      return results;
    } catch (err) {
      console.error('[CRON] Manual update failed:', err);
      throw err;
    }
  }
}

module.exports = CronScheduler;