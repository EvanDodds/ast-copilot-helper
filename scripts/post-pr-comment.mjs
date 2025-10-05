#!/usr/bin/env node
/**
 * Post validation summary comment to PR #138
 * Requires GITHUB_TOKEN environment variable with repo permissions
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_OWNER = 'EvanDodds';
const REPO_NAME = 'ast-copilot-helper';
const PR_NUMBER = 138;
const VALIDATION_FILE = join(__dirname, '..', 'PR-138-VALIDATION-SUMMARY.md');

async function postComment() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  
  if (!token) {
    console.error('❌ Error: GITHUB_TOKEN or GH_TOKEN environment variable not set');
    console.error('Please set one of these environment variables with a GitHub personal access token');
    console.error('Example: export GITHUB_TOKEN="your_token_here"');
    process.exit(1);
  }

  console.log(`📝 Reading validation summary from: ${VALIDATION_FILE}`);
  
  let body;
  try {
    body = readFileSync(VALIDATION_FILE, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`;
  
  console.log(`📤 Posting comment to PR #${PR_NUMBER}...`);
  console.log(`URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'ast-copilot-helper-validation-bot'
      },
      body: JSON.stringify({ body })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    const result = await response.json();
    
    console.log('✅ Comment posted successfully!');
    console.log(`🔗 Comment URL: ${result.html_url}`);
    console.log(`📊 Comment ID: ${result.id}`);
    
  } catch (error) {
    console.error('❌ Error posting comment:', error.message);
    process.exit(1);
  }
}

postComment();
