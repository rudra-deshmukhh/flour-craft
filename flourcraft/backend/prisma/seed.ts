import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Seed Products
  const products = [
    {
      name: 'Wheat Flour',
      description: 'Premium quality wheat flour, freshly ground',
      category: 'wheat',
      pricePerKg: 45,
      minQuantity: 1,
      maxQuantity: 25,
      imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'
    },
    {
      name: 'Ragi Flour',
      description: 'Nutritious finger millet flour, rich in calcium and iron',
      category: 'ragi',
      pricePerKg: 60,
      minQuantity: 0.5,
      maxQuantity: 15,
      imageUrl: 'https://images.unsplash.com/photo-1631264876034-c8b2c0b2e3e9?w=400'
    },
    {
      name: 'Jowar Flour',
      description: 'Gluten-free sorghum flour, perfect for healthy rotis',
      category: 'jowar',
      pricePerKg: 55,
      minQuantity: 0.5,
      maxQuantity: 15,
      imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400'
    },
    {
      name: 'Rice Flour',
      description: 'Fine rice flour for dosas, idlis and various dishes',
      category: 'rice',
      pricePerKg: 40,
      minQuantity: 0.5,
      maxQuantity: 20,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'
    },
    {
      name: 'Bajra Flour',
      description: 'Pearl millet flour, excellent source of protein and fiber',
      category: 'bajra',
      pricePerKg: 50,
      minQuantity: 0.5,
      maxQuantity: 15,
      imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400'
    },
    {
      name: 'Multigrain Flour',
      description: 'Healthy blend of wheat, jowar, bajra and ragi',
      category: 'multigrain',
      pricePerKg: 65,
      minQuantity: 1,
      maxQuantity: 20,
      imageUrl: 'https://images.unsplash.com/photo-1549313503-7ad5ac882d5d?w=400'
    }
  ];

  console.log('📦 Seeding products...');
  for (const productData of products) {
    await prisma.product.upsert({
      where: { name: productData.name },
      update: {},
      create: productData
    });
  }

  // Seed Pincode Serviceability (Major Indian cities)
  const pincodes = [
    // Bangalore
    { pincode: '560001', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560002', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560025', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560034', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560037', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560066', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560078', city: 'Bangalore', state: 'Karnataka' },
    { pincode: '560100', city: 'Bangalore', state: 'Karnataka' },
    
    // Mumbai
    { pincode: '400001', city: 'Mumbai', state: 'Maharashtra' },
    { pincode: '400013', city: 'Mumbai', state: 'Maharashtra' },
    { pincode: '400028', city: 'Mumbai', state: 'Maharashtra' },
    { pincode: '400050', city: 'Mumbai', state: 'Maharashtra' },
    { pincode: '400070', city: 'Mumbai', state: 'Maharashtra' },
    
    // Delhi
    { pincode: '110001', city: 'Delhi', state: 'Delhi' },
    { pincode: '110016', city: 'Delhi', state: 'Delhi' },
    { pincode: '110025', city: 'Delhi', state: 'Delhi' },
    { pincode: '110048', city: 'Delhi', state: 'Delhi' },
    { pincode: '110065', city: 'Delhi', state: 'Delhi' },
    
    // Pune
    { pincode: '411001', city: 'Pune', state: 'Maharashtra' },
    { pincode: '411014', city: 'Pune', state: 'Maharashtra' },
    { pincode: '411028', city: 'Pune', state: 'Maharashtra' },
    { pincode: '411045', city: 'Pune', state: 'Maharashtra' },
    
    // Hyderabad
    { pincode: '500001', city: 'Hyderabad', state: 'Telangana' },
    { pincode: '500016', city: 'Hyderabad', state: 'Telangana' },
    { pincode: '500032', city: 'Hyderabad', state: 'Telangana' },
    { pincode: '500081', city: 'Hyderabad', state: 'Telangana' }
  ];

  console.log('📍 Seeding pincode serviceability...');
  for (const pincodeData of pincodes) {
    await prisma.pincodeServiceability.upsert({
      where: { pincode: pincodeData.pincode },
      update: {},
      create: pincodeData
    });
  }

  // Seed App Configuration
  const appConfigs = [
    { key: 'MIN_ORDER_AMOUNT', value: '200' },
    { key: 'FREE_DELIVERY_THRESHOLD', value: '500' },
    { key: 'DELIVERY_CHARGE', value: '30' },
    { key: 'MAX_DELIVERY_DISTANCE_KM', value: '25' },
    { key: 'ORDER_CANCELLATION_TIME_HOURS', value: '2' },
    { key: 'SUPPORT_PHONE', value: '+91-8000-123-456' },
    { key: 'SUPPORT_EMAIL', value: 'support@flourcraft.com' },
    { key: 'APP_VERSION', value: '1.0.0' }
  ];

  console.log('⚙️ Seeding app configuration...');
  for (const config of appConfigs) {
    await prisma.appConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config
    });
  }

  // Seed Discounts
  const discounts = [
    {
      code: 'WELCOME10',
      title: 'Welcome Offer',
      description: 'Get 10% off on your first order',
      type: 'PERCENTAGE',
      value: 10,
      minAmount: 200,
      maxDiscount: 100,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      usageLimit: 1000
    },
    {
      code: 'FLAT50',
      title: 'Flat ₹50 Off',
      description: 'Get flat ₹50 off on orders above ₹500',
      type: 'FLAT',
      value: 50,
      minAmount: 500,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      usageLimit: 500
    }
  ];

  console.log('🎁 Seeding discounts...');
  for (const discountData of discounts) {
    await prisma.discount.upsert({
      where: { code: discountData.code },
      update: {},
      create: discountData
    });
  }

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });