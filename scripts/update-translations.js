// src/scripts/update-translations.js
// Run this script with: node src/scripts/update-translations.js
const fs = require('fs');
const path = require('path');

const translationsPath = path.join(process.cwd(), 'src', 'translations');
const files = fs.readdirSync(translationsPath).filter(file => file.endsWith('.json'));

// The translations we want to ensure exist
const requiredTranslations = {
  'module.customerConfig.title': 'Customer Configurations',
  'module.customerConfig.description': 'Manage customer accounts and service packages',
  'module.customerConfig.button': 'Manage Customers'
};

// Update each translation file
files.forEach(file => {
  const filePath = path.join(translationsPath, file);
  let translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Add or update translations
  let updated = false;
  Object.entries(requiredTranslations).forEach(([key, defaultValue]) => {
    // Only add English values to English files, otherwise keep existing or empty
    const isEnglish = file.startsWith('en');
    if (!translations[key] || (isEnglish && translations[key].includes('Coming Soon'))) {
      translations[key] = isEnglish ? defaultValue : (translations[key] || '');
      updated = true;
      console.log(`Updated ${key} in ${file}`);
    }
  });
  
  // Save the file if we made changes
  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    console.log(`Updated translations in ${file}`);
  } else {
    console.log(`No updates needed for ${file}`);
  }
});

console.log('Translation update complete!');