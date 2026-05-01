const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testAgg() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/internship_db');
  
  const items = await User.aggregate([
            { $match: { name: /Commercial/i } },
            {
                $lookup: {
                    from: 'profiles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'profileData'
                }
            },
            {
                $lookup: {
                    from: 'companyprofiles',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'companyData'
                }
            },
            {
                $project: {
                    name: 1,
                    avatar: {
                        $cond: [
                            { $gt: [{ $size: '$companyData' }, 0] },
                            { $arrayElemAt: ['$companyData.logo', 0] },
                            {
                                $cond: [
                                    { $gt: [{ $size: '$profileData' }, 0] },
                                    { $arrayElemAt: ['$profileData.profilePicUrl', 0] },
                                    null
                                ]
                            }
                        ]
                    }
                }
            }
        ]);
  
  console.log('Agg Result:', JSON.stringify(items, null, 2).substring(0, 500));
  process.exit();
}
testAgg();
