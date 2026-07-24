import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');
  
  const adminEmail = 'admin@securechain.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    const admin = await prisma.user.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log(`Created admin user with ID: ${admin.id}`);
  } else {
    console.log('Admin user already exists.');
  }
  
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
