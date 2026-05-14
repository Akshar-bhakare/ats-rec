import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { getClientDbConn } from './clientDbUtils.js';


dotenv.config();

const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;

export const connectDBGlobally = async (connParams = {}) => {
    try {
        const { dbName = process.env.DEFAULT_DB_NAME, ...restConnParams } = connParams;

        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

        if (!mongoUri) {
            console.log('❌ MongoDB URI is not defined in environment variables');
            console.log('❌ Checked both MONGODB_URI and MONGO_URI');
            throw new Error('MongoDB URI is not defined');
        }

        console.log(` Attempting to connect to MongoDB with URI: ${mongoUri.substring(0, 15)}...`);

        // Connect to MongoDB
        const conn = await getClientDbConn(dbName, {
            serverSelectionTimeoutMS: process.env.STARTUP_TIMEOUT ? parseInt(process.env.STARTUP_TIMEOUT) : 30000,
            ...restConnParams
        });

        console.log(`✅ MongoDB Connected: ${conn?.connection?.host}`);

        // Set up event listeners for MongoDB connection
        conn.on('error', (err) => {
            console.log('❌ MongoDB connection error:', err);
        });

        conn.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

        conn.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

        return conn;
    } catch (error) {
        console.log('❌ Error connecting to MongoDB:', error);
        throw error;
    }
};

export const isDatabaseConnected = (conn = mongoose.connection) => {
    return conn.readyState === 1;
};

export const disconnectDBGlobally = async () => {
    try {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected');
    } catch (error) {
        console.log('❌ Error disconnecting from MongoDB:', error);
    }
};

export async function modelExistsOnSameConn(doc, id, modelName = "Job") {
    try {
        const Job = doc.$__db.model(modelName);
        return await Job.exists({ _id: id });
    } catch {
        return true;
    }
}

export const loadKeysConfigFromDB = async (serviceType, serviceProvider, req) => {

    const secondTry = async () => {
        try {
            const globalConn = await getClientDbConn(DEFAULT_DB_NAME);

            cfg = await globalConn.models['Setting'].findOne({
                serviceProvider,
                serviceType,
                isActive: true,
                isDefault: true,
                isArchived: false,
            }).lean().exec();

        } catch (err) {
            console.log(
                "\n Error in getting config from Global DB: ", err,
            );
        }
    }

    let cfg;
    try {

        if (req?.conn?.models?.['Setting']) {
            cfg = await req.conn.models['Setting'].findOne({
                serviceProvider,
                serviceType,
                isActive: true,
                isDefault: true,
                isArchived: false,
            }).lean().exec();
        }

        if (!cfg) {
            await secondTry();
        }

    } catch (err) {
        await secondTry();

    }

    return cfg;

}