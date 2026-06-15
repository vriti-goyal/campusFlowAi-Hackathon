import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Batch } from '../models/Batch.js';
import { Post } from '../models/Post.js';
import { Assignment } from '../models/Assignment.js';
import { Exam } from '../models/Exam.js';
import { Placement } from '../models/Placement.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { StudentPlacementStatus } from '../models/StudentPlacementStatus.js';

export async function runClean() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected. Clearing existing demo data...');

    await User.deleteMany({ email: { $regex: /@demo\.com$/ } });
    await Batch.deleteMany({ batchCode: 'CSDS5A7K' });
    await Post.deleteMany({ title: { $regex: /Demo:/ } });
    await Assignment.deleteMany({ title: 'DBMS Assignment' });
    await Exam.deleteMany({ title: 'Operating Systems' });
    await Placement.deleteMany({ company: 'TCS Hiring Drive' });
    await CalendarEvent.deleteMany({ title: { $in: ['DBMS Assignment Deadline', 'Operating Systems Exam', 'TCS Hiring Drive Deadline'] } });
    
    console.log('Seed data removed successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

runClean();
