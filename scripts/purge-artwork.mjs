// Manual cleanup only. Lists unattached private uploads older than seven days;
// pass --confirm after reviewing the list to delete their objects and rows.
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ownerClient } from './lib/db-owner.mjs';

const client = await ownerClient();
const rows = (await client.query("select id,storage_key,file_name from emblara.order_artwork where order_id is null and created_at < now() - interval '7 days' order by created_at")).rows;
if (!rows.length) console.log('No unattached artwork is old enough to purge.');
else if (!process.argv.includes('--confirm')) console.log(rows.map((row) => `${row.id} ${row.file_name} ${row.storage_key}`).join('\n') + '\nReview these rows, then rerun with --confirm.');
else {
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1', endpoint: process.env.AWS_ENDPOINT_URL_S3, forcePathStyle: true });
  for (const row of rows) await s3.send(new DeleteObjectCommand({ Bucket: process.env.NEON_ARTWORK_BUCKET || 'emblara-artwork', Key: row.storage_key }));
  await client.query("delete from emblara.order_artwork where order_id is null and created_at < now() - interval '7 days'");
  console.log(`Purged ${rows.length} unattached artwork upload(s).`);
}
await client.end();
