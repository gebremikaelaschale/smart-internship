const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ Email credentials missing in .env');
    return false;
  }

  const mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  try {
    const info = await mailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html
    });
    console.log('✅ Email sent successfully to:', to, 'MessageID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Nodemailer Error for:', to);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    if (error.response) console.error('Server Response:', error.response);
    return false;
  }
};

module.exports = { sendEmail };
