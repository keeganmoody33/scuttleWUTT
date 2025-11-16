import { generateDigestsForAllUsers } from '@/services/digest';

async function main() {
  console.log('Starting digest generation job...');
  await generateDigestsForAllUsers();
  console.log('Digest generation job complete');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Digest generation failed:', err);
    process.exit(1);
  });
