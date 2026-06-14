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

export async function runSeed() {
  try {
    console.log('Connecting to MongoDB...');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    console.log('Connected.');

    // Clear existing demo data
    console.log('Clearing existing demo data...');
    await User.deleteMany({ email: { $regex: /@demo\.com$/ } });
    await Batch.deleteMany({ batchCode: 'CSDS5A7K' });
    await Post.deleteMany({ title: { $regex: /Demo:/ } });
    await Assignment.deleteMany({ title: 'DBMS Assignment' });
    await Exam.deleteMany({ title: 'Operating Systems' });
    await Placement.deleteMany({ company: 'TCS Hiring Drive' });
    await CalendarEvent.deleteMany({ title: { $in: ['DBMS Assignment Deadline', 'Operating Systems Exam', 'TCS Hiring Drive Deadline'] } });
    // Note: We'll delete demo StudentPlacementStatus when we drop the users.
    
    console.log('Creating Demo Users...');
    const user1 = await User.create({
      firebaseUid: 'demo_uid_1',
      email: 'student1@demo.com',
      name: 'Demo Student 1 (Eligible)',
      branch: 'CSE',
      cgpa: 8.5,
      role: 'student',
    });

    const user2 = await User.create({
      firebaseUid: 'demo_uid_2',
      email: 'student2@demo.com',
      name: 'Demo Student 2 (Not Eligible)',
      branch: 'MECH',
      cgpa: 6.5,
      role: 'student',
    });

    console.log('Creating Batch...');
    const batch = await Batch.create({
      batchName: 'CSDS Semester 5',
      batchCode: 'CSDS5A7K',
      ownerId: user1._id,
      college: 'Demo College',
      branch: 'CSE',
      semester: 5
    });

    console.log('Creating Community Posts...');
    const post1 = await Post.create({
      batchId: batch._id,
      uploadedBy: user1._id,
      type: 'general',
      title: 'Demo: Important Placement Guidelines',
      summary: 'Please review the updated placement policies for the upcoming drive.',
      category: 'Placement',
      priorityLevel: 'high',
      verificationStatus: 'verified',
      verifiedBy: user1._id
    });

    const post2 = await Post.create({
      batchId: batch._id,
      uploadedBy: user2._id,
      type: 'general',
      title: 'Demo: DBMS Chapter 3 Notes',
      summary: 'Notes for the upcoming assignment and exam.',
      category: 'Academic',
      priorityLevel: 'medium'
    });

    const post3 = await Post.create({
      batchId: batch._id,
      uploadedBy: user1._id,
      type: 'general',
      title: 'Demo: Tech Fest Registration',
      summary: 'Annual tech fest registrations are open now.',
      category: 'Event',
      priorityLevel: 'low'
    });

    console.log('Creating Assignment...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0); // 5 PM

    const assignment = await Assignment.create({
      userId: user1._id,
      batchId: batch._id,
      title: 'DBMS Assignment',
      subject: 'Database Management Systems',
      deadline: tomorrow,
      priorityLevel: 'high',
      status: 'Not Started'
    });

    // Also for user2
    await Assignment.create({
      userId: user2._id,
      batchId: batch._id,
      title: 'DBMS Assignment',
      subject: 'Database Management Systems',
      deadline: tomorrow,
      priorityLevel: 'high',
      status: 'Not Started'
    });

    console.log('Creating Exam...');
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5);
    
    await Exam.create({
      userId: user1._id,
      batchId: batch._id,
      title: 'Operating Systems',
      subject: 'OS',
      date: examDate,
      priorityLevel: 'high'
    });
    
    await Exam.create({
      userId: user2._id,
      batchId: batch._id,
      title: 'Operating Systems',
      subject: 'OS',
      date: examDate,
      priorityLevel: 'high'
    });

    console.log('Creating Placement...');
    const placementDeadline = new Date();
    placementDeadline.setDate(placementDeadline.getDate() + 1);
    placementDeadline.setHours(23, 59, 0, 0);

    const placement = await Placement.create({
      batchId: batch._id,
      company: 'TCS Hiring Drive',
      role: 'Graduate Trainee',
      package: '7 LPA',
      eligibleBranches: ['CSE', 'IT'],
      minimumCgpa: 7.0,
      deadline: placementDeadline,
      priorityScore: 90,
      status: 'active'
    });

    console.log('Creating Calendar Events...');
    const events = [
      { userId: user1._id, batchId: batch._id, title: 'DBMS Assignment Deadline', category: 'Assignment', date: tomorrow.toISOString() },
      { userId: user2._id, batchId: batch._id, title: 'DBMS Assignment Deadline', category: 'Assignment', date: tomorrow.toISOString() },
      { userId: user1._id, batchId: batch._id, title: 'Operating Systems Exam', category: 'Exam', date: examDate.toISOString() },
      { userId: user2._id, batchId: batch._id, title: 'Operating Systems Exam', category: 'Exam', date: examDate.toISOString() },
      { userId: user1._id, batchId: batch._id, title: 'TCS Hiring Drive Deadline', category: 'Placement', date: placementDeadline.toISOString() },
      { userId: user2._id, batchId: batch._id, title: 'TCS Hiring Drive Deadline', category: 'Placement', date: placementDeadline.toISOString() },
    ];
    await CalendarEvent.insertMany(events);

    console.log('Creating StudentPlacementStatus...');
    await StudentPlacementStatus.create({
      userId: user1._id,
      placementId: placement._id,
      eligibilityStatus: 'eligible',
      status: 'Not Applied'
    });

    await StudentPlacementStatus.create({
      userId: user2._id,
      placementId: placement._id,
      eligibilityStatus: 'not_eligible',
      status: 'Not Applied'
    });

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Seed error:', err);
  }
}

// Run standalone if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed().then(() => process.exit(0));
}
