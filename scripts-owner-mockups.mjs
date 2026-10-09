// Builds the store images that come from the owner's Gelato mockups
// (02-Listings/Gelato, 9 Oct 2026). These already carry the EMBLARA logo.
// Run from this folder: node scripts-owner-mockups.mjs
import sharp from 'sharp';

const ROOT = '../../../02-Listings/Gelato/';
const P = ROOT + '01-Products/';
const M = '01-Product-References/Mockups/';

// [source, output name]. Each is padded onto a white square.
const jobs = [
  [`${P}12-SOLS-11346-Perfect-Men-Polo/${M}SOLS11346_Black_Model_Front.jpg`, 'perfect-men-black-model'],
  [`${P}03-SOLS-11362-Spring-II-Polo/${M}SOLS11362_White_Model_Front.jpg`, 'spring-white-model'],
  [`${P}05-Gildan-18500-Heavy-Blend-Hoodie/${M}G18500_White_Model_Front.jpg`, 'hoodie-white-front'],
  [`${P}05-Gildan-18500-Heavy-Blend-Hoodie/${M}G18500_White_Model_Back.jpg`, 'hoodie-white-back'],
  [`${P}06-Gildan-18000-Heavy-Blend-Sweatshirt/${M}G18000_White_Model_Front.jpg`, 'sweat-white-front'],
  [`${P}06-Gildan-18000-Heavy-Blend-Sweatshirt/${M}G18000_White_Model_Back.jpg`, 'sweat-white-back'],
  [`${ROOT}04-Shared-References/Gildan-5000-and-2000-Front-Back/G2000_Sports-Grey_Model_Front-Couple.jpg`, 'tee-sport-grey-couple'],
];

for (const [src, name] of jobs) {
  await sharp(src)
    .resize(1000, 1000, { fit: 'contain', background: '#ffffff' })
    .webp({ quality: 82 })
    .toFile(`public/products/${name}.webp`);
  console.log('ok', name);
}
