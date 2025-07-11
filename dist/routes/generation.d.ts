import express from "express";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { StatelessSessionManager } from './session';
export declare function initializeGenerationRoutes(messageDB: DrizzleMessageHistoryDB, sessionManager: StatelessSessionManager): express.Router;
