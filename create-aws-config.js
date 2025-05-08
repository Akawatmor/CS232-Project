const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('AWS Configuration Setup');
console.log('=======================');
console.log('This script will help you set up your AWS credentials for deployment.');
console.log('You will need your AWS access key, secret key, and preferred region.\n');

const questions = [
  { key: 'accessKeyId', prompt: 'AWS Access Key ID: ' },
  { key: 'secretAccessKey', prompt: 'AWS Secret Access Key: ' },
  { key: 'region', prompt: 'AWS Region (default: us-east-1): ', default: 'us-east-1' },
  { key: 'bucketName', prompt: 'S3 Bucket Name (default: salepoint-webapp): ', default: 'salepoint-webapp' },
  { key: 'profile', prompt: 'AWS Profile Name (default: default): ', default: 'default' }
];

const answers = {};

function askQuestion(i) {
  if (i >= questions.length) {
    createConfigFiles();
    return;
  }

  rl.question(questions[i].prompt, (answer) => {
    answers[questions[i].key] = answer || questions[i].default;
    askQuestion(i + 1);
  });
}

function createConfigFiles() {
  // Create AWS credentials file if it doesn't exist
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const awsDir = path.join(homeDir, '.aws');
  
  if (!fs.existsSync(awsDir)) {
    fs.mkdirSync(awsDir);
  }
  
  // Create credentials file
  const credentialsPath = path.join(awsDir, 'credentials');
  let credentialsContent = '';
  
  if (fs.existsSync(credentialsPath)) {
    credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
  }
  
  // Check if profile already exists
  const profileRegex = new RegExp(`\\[${answers.profile}\\]([^\\[]*)`);
  if (profileRegex.test(credentialsContent)) {
    const updatedContent = credentialsContent.replace(
      profileRegex,
      `[${answers.profile}]
aws_access_key_id = ${answers.accessKeyId}
aws_secret_access_key = ${answers.secretAccessKey}
`
    );
    fs.writeFileSync(credentialsPath, updatedContent);
  } else {
    const newProfile = `
[${answers.profile}]
aws_access_key_id = ${answers.accessKeyId}
aws_secret_access_key = ${answers.secretAccessKey}
`;
    fs.appendFileSync(credentialsPath, newProfile);
  }
  
  // Create config file
  const configPath = path.join(awsDir, 'config');
  let configContent = '';
  
  if (fs.existsSync(configPath)) {
    configContent = fs.readFileSync(configPath, 'utf8');
  }
  
  const configProfileName = answers.profile === 'default' ? 'default' : `profile ${answers.profile}`;
  const configProfileRegex = new RegExp(`\\[${configProfileName}\\]([^\\[]*)`);
  
  if (configProfileRegex.test(configContent)) {
    const updatedContent = configContent.replace(
      configProfileRegex,
      `[${configProfileName}]
region = ${answers.region}
`
    );
    fs.writeFileSync(configPath, updatedContent);
  } else {
    const newProfile = `
[${configProfileName}]
region = ${answers.region}
`;
    fs.appendFileSync(configPath, newProfile);
  }
  
  // Update deploy script with the provided bucket name
  const deployScriptPath = path.join(__dirname, 'aws-deploy.js');
  if (fs.existsSync(deployScriptPath)) {
    let deployScript = fs.readFileSync(deployScriptPath, 'utf8');
    deployScript = deployScript.replace(
      /s3BucketName: '([^']*)'/, 
      `s3BucketName: '${answers.bucketName}'`
    );
    deployScript = deployScript.replace(
      /region: '([^']*)'/, 
      `region: '${answers.region}'`
    );
    deployScript = deployScript.replace(
      /profile: '([^']*)'/, 
      `profile: '${answers.profile}'`
    );
    fs.writeFileSync(deployScriptPath, deployScript);
  }
  
  console.log('\nAWS configuration completed successfully!');
  console.log(`Credentials saved to: ${credentialsPath}`);
  console.log(`Config saved to: ${configPath}`);
  console.log(`Deployment script updated with your settings.`);
  console.log('\nNext steps:');
  console.log('1. Run "npm install" to install dependencies');
  console.log('2. Run "npm run deploy" to deploy your application to AWS');
  
  rl.close();
}

askQuestion(0);
