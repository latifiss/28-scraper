const Event = require('../models/event.model');
const cron = require('node-cron');

const runCleanupJob = async () => {
  try {
    const now = new Date();
    console.log(`🕒 [${now.toISOString()}] Running daily event cleanup job...`);

    const result = await Event.updateExpiredNewFlags();

    if (result.modifiedCount > 0) {
      console.log(
        `✅ Updated ${result.modifiedCount} events where is_new expired after 4 days`
      );
    } else {
      console.log('✅ No events needed updating');
    }

    console.log(`✅ Cleanup job completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('❌ Error in event cleanup job:', error);
  }
};

const job = cron.schedule('0 0 * * *', runCleanupJob, {
  scheduled: true,
  timezone: 'Etc/GMT',
});

module.exports = job;
