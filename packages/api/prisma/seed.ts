import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (optional - comment out if you want to keep data)
  console.log('🗑️  Clearing existing data...');
  await prisma.message.deleteMany({});
  await prisma.thread.deleteMany({});
  await prisma.sender.deleteMany({});
  await prisma.listing.deleteMany({});

  // Create two listings with unique email aliases
  console.log('🏠 Creating listings...');
  
  const listing1 = await prisma.listing.create({
    data: {
      address: '123 Main Street',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 3A8',
      price: 899000,
      emailAlias: 'l-abc123', // Fixed alias for testing
      sellerId: 'seller-1',
      status: 'ACTIVE',
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      address: '456 Oak Avenue',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1P 5N2',
      price: 675000,
      emailAlias: 'l-xyz789', // Fixed alias for testing
      sellerId: 'seller-1',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created listing 1: ${listing1.id}`);
  console.log(`   Email: ${listing1.emailAlias}@inbox.yourapp.ca`);
  console.log(`   Address: ${listing1.address}, ${listing1.city}`);
  console.log();
  console.log(`✅ Created listing 2: ${listing2.id}`);
  console.log(`   Email: ${listing2.emailAlias}@inbox.yourapp.ca`);
  console.log(`   Address: ${listing2.address}, ${listing2.city}`);
  console.log();

  // Create some sample senders
  console.log('👤 Creating sample senders...');
  
  const sender1 = await prisma.sender.create({
    data: {
      email: 'john.smith@remax.com',
      name: 'John Smith',
      domain: 'remax.com',
      isVerified: true,
      brokerage: 'RE/MAX Elite',
    },
  });

  const sender2 = await prisma.sender.create({
    data: {
      email: 'sarah.jones@royallepage.ca',
      name: 'Sarah Jones',
      domain: 'royallepage.ca',
      isVerified: true,
      brokerage: 'Royal LePage',
    },
  });

  console.log(`✅ Created sender 1: ${sender1.email}`);
  console.log(`✅ Created sender 2: ${sender2.email}`);
  console.log();

  console.log('🎉 Seeding complete!');
  console.log();
  console.log('📧 Test Email Addresses:');
  console.log(`   Listing 1: ${listing1.emailAlias}@inbox.yourapp.ca`);
  console.log(`   Listing 2: ${listing2.emailAlias}@inbox.yourapp.ca`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

