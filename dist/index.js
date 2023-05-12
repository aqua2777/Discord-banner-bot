"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const Client_1 = __importDefault(require("./structures/Client"));
let client = new Client_1.default();
dotenv_1.default.config();
client.start();
