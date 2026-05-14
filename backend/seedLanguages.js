/**
 * Language Seed Script
 * Run this to populate the Language collection with supported programming languages
 * 
 * Usage: node seedLanguages.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getClientDbConn } from './src/utils/clientDbUtils.js';

dotenv.config();

const languages = [
    {
        judge0Id: 71,
        name: "Python 3",
        extension: ".py",
        version: "3.10.0",
        isActive: true
    },
    {
        judge0Id: 63,
        name: "JavaScript (Node.js)",
        extension: ".js",
        version: "16.14.0",
        isActive: true
    },
    {
        judge0Id: 54,
        name: "C++ (GCC 9.2.0)",
        extension: ".cpp",
        version: "9.2.0",
        isActive: true
    },
    {
        judge0Id: 62,
        name: "Java (OpenJDK 13.0.1)",
        extension: ".java",
        version: "13.0.1",
        isActive: true
    },
    {
        judge0Id: 50,
        name: "C (GCC 9.2.0)",
        extension: ".c",
        version: "9.2.0",
        isActive: true
    },
    {
        judge0Id: 51,
        name: "C# (Mono 6.6.0.161)",
        extension: ".cs",
        version: "6.6.0.161",
        isActive: true
    },
    {
        judge0Id: 68,
        name: "PHP (7.4.1)",
        extension: ".php",
        version: "7.4.1",
        isActive: true
    },
    {
        judge0Id: 72,
        name: "Ruby (2.7.0)",
        extension: ".rb",
        version: "2.7.0",
        isActive: true
    },
    {
        judge0Id: 73,
        name: "Rust (1.40.0)",
        extension: ".rs",
        version: "1.40.0",
        isActive: true
    },
    {
        judge0Id: 82,
        name: "SQL (SQLite 3.27.2)",
        extension: ".sql",
        version: "3.27.2",
        isActive: true
    },
    {
        judge0Id: 83,
        name: "Swift (5.2.3)",
        extension: ".swift",
        version: "5.2.3",
        isActive: true
    },
    {
        judge0Id: 74,
        name: "TypeScript (3.7.4)",
        extension: ".ts",
        version: "3.7.4",
        isActive: true
    }
];

async function seedLanguages() {
    try {
        console.log('🌱 Starting language seed...');

        // Connect to database
        const dbName = "ApplyCup";
        console.log(`📦 Connecting to database: ${dbName}`);

        const conn = await getClientDbConn(dbName);
        console.log('✅ Connected to database');

        // Clear existing languages (optional - comment out if you want to keep existing)
        // await conn.models['Language'].deleteMany({});
        // console.log('🗑️  Cleared existing languages');

        // Check for existing languages
        const existingCount = await conn.models['Language'].countDocuments();
        console.log(`📊 Existing languages: ${existingCount}`);

        // Insert languages
        const result = await conn.models['Language'].insertMany(languages, { ordered: false });
        console.log(`✅ Inserted ${result.length} languages`);

        // Display inserted languages
        console.log('\n📋 Inserted Languages:');
        result.forEach(lang => {
            console.log(`   - ${lang.name} (Judge0 ID: ${lang.judge0Id}) - ${lang._id}`);
        });

        console.log('\n✅ Language seed completed successfully!');
        console.log('\n💡 Copy these Language IDs for testing:');
        console.log('   Python 3:', result.find(l => l.judge0Id === 71)?._id);
        console.log('   JavaScript:', result.find(l => l.judge0Id === 63)?._id);
        console.log('   C++:', result.find(l => l.judge0Id === 54)?._id);
        console.log('   Java:', result.find(l => l.judge0Id === 62)?._id);

        process.exit(0);
    } catch (error) {
        if (error.code === 11000) {
            console.log('⚠️  Some languages already exist (duplicate judge0Id)');

            // Fetch and display existing languages
            const dbName = process.env.DEFAULT_DB_NAME;
            const conn = await getClientDbConn(dbName);
            const existingLanguages = await conn.models['Language'].find().lean();

            console.log('\n📋 Existing Languages:');
            existingLanguages.forEach(lang => {
                console.log(`   - ${lang.name} (Judge0 ID: ${lang.judge0Id}) - ${lang._id}`);
            });

            console.log('\n💡 Use these Language IDs for testing:');
            console.log('   Python 3:', existingLanguages.find(l => l.judge0Id === 71)?._id);
            console.log('   JavaScript:', existingLanguages.find(l => l.judge0Id === 63)?._id);
            console.log('   C++:', existingLanguages.find(l => l.judge0Id === 54)?._id);
            console.log('   Java:', existingLanguages.find(l => l.judge0Id === 62)?._id);

            process.exit(0);
        } else {
            console.error('❌ Error seeding languages:', error);
            process.exit(1);
        }
    }
}

seedLanguages();
