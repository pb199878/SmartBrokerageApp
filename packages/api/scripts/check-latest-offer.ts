import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking latest message and offer...");

  // Get the latest message
  const message = await prisma.message.findFirst({
    orderBy: { createdAt: "desc" },
    include: { offer: true, thread: true },
  });

  if (!message) {
    console.log("❌ No messages found.");
    return;
  }

  console.log(`\n📧 Latest Message:`);
  console.log(`ID: ${message.id}`);
  console.log(`Subject: ${message.subject}`);
  console.log(`SubCategory: ${message.subCategory}`);
  console.log(`Created At: ${message.createdAt}`);

  if (message.offer) {
    console.log(`\n✅ Offer Created:`);
    console.log(`ID: ${message.offer.id}`);
    console.log(`Status: ${message.offer.status}`);
    console.log(
      `Date Validation Status: ${message.offer.dateValidationStatus}`,
    );
    console.log(
      `Date Validation Issues: ${JSON.stringify(message.offer.dateValidationIssues, null, 2)}`,
    );
  } else {
    console.log(`\n⚠️ No Offer linked to this message.`);
    if (message.subCategory === "GENERAL") {
      console.log("   (This might indicate an INVALID offer was rejected)");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
