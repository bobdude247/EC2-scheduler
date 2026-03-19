import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

const region = process.env.AWS_REGION || 'us-east-1';
const dryRun = (process.env.DRY_RUN || 'true').toLowerCase() === 'true';

async function main() {
  const client = new EC2Client({ region });

  const command = new DescribeInstancesCommand({ MaxResults: 5 });
  const response = await client.send(command);

  const count = (response.Reservations || []).reduce(
    (sum, reservation) => sum + (reservation.Instances?.length || 0),
    0,
  );

  console.log(`[ec2-scheduler] region=${region} dryRun=${dryRun} visibleInstances=${count}`);
}

main().catch((error) => {
  console.error('[ec2-scheduler] startup error:', error);
  process.exitCode = 1;
});
