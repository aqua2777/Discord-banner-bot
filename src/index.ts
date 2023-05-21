import dotenv from 'dotenv';
import Client from './structures/Client';

let client = new Client();

dotenv.config();
client.start(); 
