/**
 * Seed: 8 products for a coffee equipment store.
 * Run with: npx prisma db seed
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const products = [
  {
    id: "prod_espresso_machine_pro",
    name: "Brewline Pro Espresso Machine",
    description:
      "15-bar dual-boiler espresso machine with PID temperature control, 58mm commercial group head and a built-in steam wand for cafe-quality shots at home.",
    priceInPaise: 2499900,
    imageUrl:
      "https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800",
    category: "espresso-machines",
    stock: 12,
  },
  {
    id: "prod_burr_grinder",
    name: "Brewline Conical Burr Grinder",
    description:
      "40mm hardened conical burrs with 30 stepped grind settings from espresso-fine to french-press-coarse. Low-retention chute and anti-static grounds bin.",
    priceInPaise: 849900,
    imageUrl:
      "https://images.unsplash.com/photo-1570087935869-9da023a88cdc?w=800",
    category: "grinders",
    stock: 25,
  },
  {
    id: "prod_gooseneck_kettle",
    name: "Brewline Gooseneck Pour-Over Kettle",
    description:
      "1L variable-temperature gooseneck kettle (40-100°C) with 60-minute hold, built-in brew timer and a precision flow spout for repeatable pour-overs.",
    priceInPaise: 329900,
    imageUrl:
      "https://images.unsplash.com/photo-1520970014086-2208d157c9e2?w=800",
    category: "kettles",
    stock: 3,
  },
  {
    id: "prod_french_press",
    name: "Brewline French Press 850ml",
    description:
      "Double-wall borosilicate glass french press with a stainless 4-level filtration system. Brews 4 cups; dishwasher-safe and BPA-free.",
    priceInPaise: 189900,
    imageUrl:
      "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800",
    category: "brewers",
    stock: 40,
  },
  {
    id: "prod_aeropress",
    name: "Brewline AeroPress Companion",
    description:
      "Compact immersion-and-pressure brewer with 350ml chamber, two reusable micro-filters and a travel tumbler lid. Perfect for office and travel brewing.",
    priceInPaise: 399900,
    imageUrl:
      "https://images.unsplash.com/photo-1558122104-355edad709f6?w=800",
    category: "brewers",
    stock: 18,
  },
  {
    id: "prod_coffee_scale",
    name: "Brewline Precision Coffee Scale",
    description:
      "0.1g-resolution pour-over scale with built-in brew timer, auto-tare and a water-resistant silicone mat. USB-C rechargeable, 2kg capacity.",
    priceInPaise: 249900,
    imageUrl:
      "https://images.unsplash.com/photo-1603024058877-4a0d162c7a1b?w=800",
    category: "accessories",
    stock: 30,
  },
  {
    id: "prod_milk_pitcher",
    name: "Brewline Milk Frothing Pitcher 600ml",
    description:
      "Food-grade 304 stainless pitcher with internal graduation marks and a short, sharp spout engineered for latte-art microfoam control.",
    priceInPaise: 99900,
    imageUrl:
      "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800",
    category: "accessories",
    stock: 55,
  },
  {
    id: "prod_tamper_58mm",
    name: "Brewline Calibrated Tamper 58mm",
    description:
      "Spring-loaded calibrated tamper with a flat 58mm stainless base and ergonomic walnut handle. Applies consistent 30lb pressure every time.",
    priceInPaise: 149900,
    imageUrl:
      "https://images.unsplash.com/photo-1600612253971-422e7f7faeb6?w=800",
    category: "accessories",
    stock: 0,
  },
];

async function main() {
  console.log("Seeding coffee equipment catalog…");
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        priceInPaise: product.priceInPaise,
        imageUrl: product.imageUrl,
        category: product.category,
        stock: product.stock,
      },
      create: product,
    });
    console.log(`  ✓ ${product.name} (${product.id})`);
  }
  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
