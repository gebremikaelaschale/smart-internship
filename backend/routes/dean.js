const express = require('express');
const auth = require('../middleware/authMiddleware');
const universityRoleMiddleware = require('../middleware/universityRoleMiddleware');
const { createDepartmentAndHod } = require('../controllers/governanceController');
const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');
const Application = require('../models/Application');
const Internship = require('../models/Internship');

const router = express.Router();

router.post('/create-department-and-hod', auth, universityRoleMiddleware(['dean']), createDepartmentAndHod);

router.get('/stats', auth, universityRoleMiddleware(['dean']), async (req, res) => {
	try {
		const dean = await User.findById(req.user?.id)
			.select('_id collegeId departmentId role adminType')
			.lean();

		if (!dean) {
			return res.status(404).json({ message: 'Dean account not found.' });
		}

		const collegeId = dean.collegeId;
		if (!collegeId) {
			return res.status(403).json({ message: 'Your dean account is not linked to a college.' });
		}

		const college = await College.findById(collegeId).select('_id name').lean();
		if (!college) {
			return res.status(404).json({ message: 'Assigned college not found.' });
		}

		const departments = await Department.find({ collegeId: college._id })
			.select('_id name')
			.lean();

		const departmentIds = departments.map((department) => department._id);
		const departmentObjectIds = departmentIds.map((departmentId) => new mongoose.Types.ObjectId(departmentId));
		const collegeMatchClauses = [
			{ collegeId: college._id }
		];

		if (college.name) {
			collegeMatchClauses.push({ college: college.name });
		}

		const studentFilter = {
			role: { $in: ['student', 'Student'] },
			$or: [
				...collegeMatchClauses,
				...(departmentObjectIds.length > 0 ? [{ departmentId: { $in: departmentObjectIds } }] : [])
			]
		};

		const employerFilter = {
			role: { $in: ['employer', 'Industry Partner'] },
			$or: collegeMatchClauses
		};

		const [studentIds, employerIds] = await Promise.all([
			User.distinct('_id', studentFilter),
			User.distinct('_id', employerFilter)
		]);

		const totalStudents = studentIds.length;
		const industryPartners = employerIds.length;
		const internshipCount = employerIds.length > 0
			? await Internship.countDocuments({ companyId: { $in: employerIds } })
			: 0;
		const applicationCount = studentIds.length > 0
			? await Application.countDocuments({ studentId: { $in: studentIds } })
			: 0;
		const departmentLookup = {
			from: 'departments',
			let: {
				studentDepartmentId: '$student.departmentId',
				studentDepartmentName: '$student.department',
				collegeId: new mongoose.Types.ObjectId(college._id)
			},
			pipeline: [
				{
					$match: {
						$expr: {
							$and: [
								{ $eq: ['$collegeId', '$$collegeId'] },
								{
									$or: [
										{
											$and: [
												{ $ne: ['$$studentDepartmentId', null] },
												{ $eq: ['$_id', '$$studentDepartmentId'] }
											]
										},
										{
											$and: [
												{ $ne: ['$$studentDepartmentName', ''] },
												{ $eq: ['$name', '$$studentDepartmentName'] }
											]
										}
									]
								}
							]
						}
					}
				}
			],
			as: 'studentDepartment'
		};

		// Simplified: count placed applications for college-scoped students (handles legacy data)
		const placedStudents = studentIds.length > 0
			? await Application.countDocuments({ 
				studentId: { $in: studentIds },
				status: { $in: ['Accepted', 'Placed'] }
			})
			: 0;
		
		const placementRate = applicationCount > 0
			? Math.round((placedStudents / applicationCount) * 100)
			: 0;

		const recentActivities = await Application.aggregate([
			{ $match: { 
				studentId: { $in: studentIds },
				status: { $in: ['Accepted', 'Placed', 'Interview', 'Shortlisted'] } 
			} },
			{
				$lookup: {
					from: 'users',
					localField: 'studentId',
					foreignField: '_id',
					as: 'student'
				}
			},
			{ $unwind: '$student' },
			{ $lookup: departmentLookup },
			{ $unwind: { path: '$studentDepartment', preserveNullAndEmptyArrays: true } },
			{ $sort: { updatedAt: -1, createdAt: -1 } },
			{ $limit: 5 },
			{
				$project: {
					status: 1,
					updatedAt: 1,
					createdAt: 1,
					studentName: { $ifNull: ['$student.fullName', { $ifNull: ['$student.name', 'Unnamed Student'] }] },
					departmentName: { $ifNull: ['$studentDepartment.name', '$student.department'] }
				}
			}
		]);

		const departmentComparison = await Application.aggregate([
			{ $match: { 
				studentId: { $in: studentIds },
				status: { $in: ['Pending', 'Seen', 'Shortlisted', 'Interview', 'Accepted', 'Offered', 'Placed', 'Rejected', 'Withdrawn'] } 
			} },
			{
				$lookup: {
					from: 'users',
					localField: 'studentId',
					foreignField: '_id',
					as: 'student'
				}
			},
			{ $unwind: '$student' },
			{ $lookup: departmentLookup },
			{ $unwind: { path: '$studentDepartment', preserveNullAndEmptyArrays: true } },
			{
				$group: {
					_id: { $ifNull: ['$studentDepartment.name', '$student.department'] },
					totalApplications: { $sum: 1 },
					placedApplications: {
						$sum: {
							$cond: [{ $in: ['$status', ['Accepted', 'Placed']] }, 1, 0]
						}
					}
				}
			},
			{
				$project: {
					_id: 0,
					department: '$_id',
					totalApplications: 1,
					placementCount: '$placedApplications',
					placementRate: {
						$cond: [
							{ $gt: ['$totalApplications', 0] },
							{ $round: [{ $multiply: [{ $divide: ['$placedApplications', '$totalApplications'] }, 100] }, 0] },
							0
						]
					}
				}
			},
			{ $sort: { placementRate: -1, totalApplications: -1 } },
			{ $limit: 6 }
		]);

		return res.json({
			college: {
				id: college._id,
				name: college.name
			},
			stats: {
				students: totalStudents,
				industryPartners,
				departments: departments.length,
				internships: internshipCount,
				applications: applicationCount,
				placedStudents,
				eligibleStudents: totalStudents,
				placementRate
			},
			analytics: {
				departmentComparison,
				recentActivities: recentActivities.map((activity) => ({
					id: String(activity._id || `${activity.studentName}-${activity.updatedAt}`),
					status: activity.status,
					title: `${activity.studentName} ${String(activity.status || '').toLowerCase()} in ${activity.departmentName}`,
					message: `${activity.studentName} moved to ${String(activity.status || '').toLowerCase()} in ${activity.departmentName}.`,
					timestamp: activity.updatedAt || activity.createdAt || new Date()
				}))
			}
		});
	} catch (error) {
		return res.status(500).json({ message: 'Failed to load dean statistics.' });
	}
});

module.exports = router;
