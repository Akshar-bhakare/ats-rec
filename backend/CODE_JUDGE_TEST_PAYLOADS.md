# Code Judge API - Test Payloads

This document contains JSON payloads to test the Code Judge API endpoints in order.

## Prerequisites

1. **Get Authentication Token**
   - Login via `/api/auth/login` to get JWT token
   - Use this token in all subsequent requests

2. **Base URL**: `http://localhost:8080/api/code-judge`

---

## 1️⃣ CREATE INTERVIEW

**Endpoint**: `POST /api/code-judge/interviews`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Cookie": "token=YOUR_JWT_TOKEN_HERE"
}
```

**Request Body**:
```json
{
  "title": "Senior Backend Engineer - Round 1",
  "candidateIds": ["USER_ID_1", "USER_ID_2"],
  "recruiterId": "RECRUITER_USER_ID",
  "startTime": "2025-12-27T10:00:00Z",
  "endTime": "2025-12-27T12:00:00Z"
}
```

**Expected Response** (201):
```json
{
  "interviewId": "676d1234567890abcdef1234",
  "title": "Senior Backend Engineer - Round 1",
  "candidateIds": ["USER_ID_1", "USER_ID_2"],
  "recruiterId": "RECRUITER_USER_ID",
  "startTime": "2025-12-27T10:00:00.000Z",
  "endTime": "2025-12-27T12:00:00.000Z",
  "status": "scheduled",
  "createdAt": "2025-12-26T16:48:00.000Z"
}
```

**Save**: `interviewId` for next steps

---

## 2️⃣ UPDATE INTERVIEW STATUS TO ACTIVE

**Endpoint**: `PATCH /api/code-judge/interviews/:interviewId/status`

**Request Body**:
```json
{
  "status": "active"
}
```

**Expected Response** (200):
```json
{
  "interviewId": "676d1234567890abcdef1234",
  "status": "active",
  "message": "Interview status updated successfully"
}
```

---

## 3️⃣ CREATE LANGUAGES (First Time Setup)

Before creating problems, you need to seed language data.

**Endpoint**: `POST /api/code-judge/languages` (You'll need to create this route or manually insert)

**Manual MongoDB Insert** (Recommended for now):
```javascript
// Connect to MongoDB and run:
db.languages.insertMany([
  {
    judge0Id: 71,
    name: "Python 3",
    extension: ".py",
    version: "3.10.0",
    isActive: true
  },
  {
    judge0Id: 63,
    name: "JavaScript (Node.js)",
    extension: ".js",
    version: "16.14.0",
    isActive: true
  },
  {
    judge0Id: 54,
    name: "C++ (GCC 9.2.0)",
    extension: ".cpp",
    version: "9.2.0",
    isActive: true
  },
  {
    judge0Id: 62,
    name: "Java (OpenJDK 13.0.1)",
    extension: ".java",
    version: "13.0.1",
    isActive: true
  }
]);
```

**Save**: Language `_id` values for next steps

---

## 4️⃣ CREATE PROBLEM

**Endpoint**: `POST /api/code-judge/problems/interviews/:interviewId/problems`

**Request Body**:
```json
{
  "title": "Two Sum",
  "description": "# Two Sum\n\nGiven an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\n## Example\n\n**Input**: nums = [2,7,11,15], target = 9\n**Output**: [0,1]\n**Explanation**: Because nums[0] + nums[1] == 9, we return [0, 1].\n\n## Constraints\n\n- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- -10^9 <= target <= 10^9\n- Only one valid answer exists.",
  "difficulty": "easy",
  "constraints": "2 <= nums.length <= 10^4",
  "timeLimit": 2000,
  "memoryLimit": 256000,
  "allowedLanguages": ["LANGUAGE_ID_PYTHON", "LANGUAGE_ID_JAVASCRIPT", "LANGUAGE_ID_CPP"]
}
```

**Expected Response** (201):
```json
{
  "problemId": "676d5678901234abcdef5678",
  "interviewId": "676d1234567890abcdef1234",
  "title": "Two Sum",
  "difficulty": "easy",
  "timeLimit": 2000,
  "memoryLimit": 256000,
  "totalTestCases": 0,
  "isActive": true,
  "createdAt": "2025-12-26T16:50:00.000Z"
}
```

**Save**: `problemId` for next steps

---

## 5️⃣ ADD TEST CASES

**Endpoint**: `POST /api/code-judge/testcases/problems/:problemId/testcases`

**Request Body**:
```json
{
  "testCases": [
    {
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "isSample": true,
      "weight": 1,
      "order": 1
    },
    {
      "input": "[3,2,4]\n6",
      "expectedOutput": "[1,2]",
      "isSample": true,
      "weight": 1,
      "order": 2
    },
    {
      "input": "[3,3]\n6",
      "expectedOutput": "[0,1]",
      "isSample": true,
      "weight": 2,
      "order": 3
    },
    {
      "input": "[1,5,3,7,9]\n12",
      "expectedOutput": "[2,4]",
      "isSample": true,
      "weight": 2,
      "order": 4
    }
  ]
}
```

**Expected Response** (201):
```json
{
  "problemId": "676d5678901234abcdef5678",
  "testCasesAdded": 4,
  "sampleCount": 2,
  "hiddenCount": 2,
  "testCases": [
    {
      "_id": "676d9012345678abcdef9012",
      "problemId": "676d5678901234abcdef5678",
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "isSample": true,
      "weight": 1,
      "order": 1
    }
    // ... more test cases
  ]
}
```

---

## 6️⃣ GET PROBLEM DETAILS (As Candidate)

**Endpoint**: `GET /api/code-judge/problems/:problemId?includeTestCases=true`

**Expected Response** (200):
```json
{
  "_id": "676d5678901234abcdef5678",
  "title": "Two Sum",
  "description": "# Two Sum\n\n...",
  "difficulty": "easy",
  "timeLimit": 2000,
  "memoryLimit": 256000,
  "allowedLanguages": [
    {
      "_id": "LANGUAGE_ID_PYTHON",
      "name": "Python 3",
      "judge0Id": 71,
      "extension": ".py",
      "version": "3.10.0"
    }
  ],
  "totalTestCases": 4,
  "sampleTestCases": 2,
  "hiddenTestCases": 2,
  "testCases": [
    // Only sample test cases visible to candidates
    {
      "_id": "676d9012345678abcdef9012",
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "isSample": true,
      "order": 1
    },
    {
      "_id": "676d9012345678abcdef9013",
      "input": "[3,2,4]\n6",
      "expectedOutput": "[1,2]",
      "isSample": true,
      "order": 2
    }
  ]
}
```

---

## 7️⃣ SUBMIT CODE (As Candidate)

**Endpoint**: `POST /api/code-judge/submissions/interviews/:interviewId/submissions`

**Request Body** (Python Solution):
```json
{
  "problemId": "676d5678901234abcdef5678",
  "languageId": "LANGUAGE_ID_PYTHON",
  "sourceCode": "def twoSum(nums, target):\n    hashmap = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in hashmap:\n            return [hashmap[complement], i]\n        hashmap[num] = i\n    return []\n\n# Read input\nimport json\nnums = json.loads(input())\ntarget = int(input())\nresult = twoSum(nums, target)\nprint(json.dumps(result))"
}
```

**Request Body** (JavaScript Solution):
```json
{
  "problemId": "676d5678901234abcdef5678",
  "languageId": "LANGUAGE_ID_JAVASCRIPT",
  "sourceCode": "function twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}\n\n// Read input\nconst readline = require('readline');\nconst rl = readline.createInterface({\n    input: process.stdin,\n    output: process.stdout\n});\n\nlet lines = [];\nrl.on('line', (line) => {\n    lines.push(line);\n    if (lines.length === 2) {\n        const nums = JSON.parse(lines[0]);\n        const target = parseInt(lines[1]);\n        const result = twoSum(nums, target);\n        console.log(JSON.stringify(result));\n        rl.close();\n    }\n});"
}
```

**Expected Response** (201):
```json
{
  "submissionId": "676dabc1234567890abcdef1",
  "status": "queued",
  "attemptNumber": 1,
  "totalTestCases": 4,
  "message": "Submission received, execution in progress"
}
```

**Save**: `submissionId` for checking results

---

## 8️⃣ GET SUBMISSION DETAILS

**Endpoint**: `GET /api/code-judge/submissions/:submissionId?includeSourceCode=true`

**Expected Response** (200):
```json
{
  "_id": "676dabc1234567890abcdef1",
  "userId": {
    "_id": "USER_ID_1",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "problemId": {
    "_id": "676d5678901234abcdef5678",
    "title": "Two Sum",
    "difficulty": "easy"
  },
  "language": {
    "_id": "LANGUAGE_ID_PYTHON",
    "name": "Python 3",
    "judge0Id": 71
  },
  "sourceCode": "def twoSum(nums, target):\n    ...",
  "attemptNumber": 1,
  "status": "running",
  "judge0Token": "dummy_token_676dabc1234567890abcdef1_1735234800000",
  "webhookReceived": false,
  "totalTestCases": 4,
  "passedTestCases": null,
  "score": null,
  "createdAt": "2025-12-26T17:00:00.000Z",
  "results": [],
  "totalResults": 0,
  "visibleResults": 0
}
```

---

## 9️⃣ GET ALL SUBMISSIONS FOR INTERVIEW

**Endpoint**: `GET /api/code-judge/submissions/interviews/:interviewId/submissions?problemId=:problemId`

**Expected Response** (200):
```json
{
  "interviewId": "676d1234567890abcdef1234",
  "submissions": [
    {
      "_id": "676dabc1234567890abcdef1",
      "problemId": {
        "_id": "676d5678901234abcdef5678",
        "title": "Two Sum",
        "difficulty": "easy"
      },
      "language": {
        "_id": "LANGUAGE_ID_PYTHON",
        "name": "Python 3"
      },
      "userId": {
        "_id": "USER_ID_1",
        "firstName": "John",
        "lastName": "Doe"
      },
      "attemptNumber": 1,
      "status": "running",
      "passedTestCases": null,
      "totalTestCases": 4,
      "score": null,
      "createdAt": "2025-12-26T17:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "skip": 0
}
```

---

## 🔟 MARK SUBMISSION AS FINAL

**Endpoint**: `PATCH /api/code-judge/submissions/:submissionId/finalize`

**Request Body**:
```json
{
  "isFinalSubmission": true
}
```

**Expected Response** (200):
```json
{
  "submissionId": "676dabc1234567890abcdef1",
  "isFinalSubmission": true,
  "message": "Submission marked as final for scoring"
}
```

---

## Additional Test Scenarios

### Add More Candidates to Interview

**Endpoint**: `POST /api/code-judge/interviews/:interviewId/candidates`

```json
{
  "candidateIds": ["USER_ID_3", "USER_ID_4"]
}
```

### Get Interview Leaderboard (Admin/Recruiter)

**Endpoint**: `GET /api/code-judge/submissions/interviews/:interviewId/leaderboard`

### Rejudge Submission (Admin)

**Endpoint**: `POST /api/code-judge/submissions/:submissionId/rejudge`

### Update Problem

**Endpoint**: `PATCH /api/code-judge/problems/:problemId`

```json
{
  "difficulty": "medium",
  "timeLimit": 3000
}
```

### Toggle Problem Visibility

**Endpoint**: `PATCH /api/code-judge/problems/:problemId/visibility`

```json
{
  "isActive": false
}
```

---

## Testing Order

1. ✅ Create Interview
2. ✅ Update Interview Status to "active"
3. ✅ Seed Languages (manual MongoDB insert)
4. ✅ Create Problem
5. ✅ Add Test Cases
6. ✅ Get Problem Details (verify test cases)
7. ✅ Submit Code (as candidate)
8. ✅ Get Submission Details
9. ✅ Mark as Final Submission
10. ✅ Get Leaderboard (as admin)

---

## Common Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "problemId, languageId, and sourceCode are required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You are not authorized to submit for this interview"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Interview not found"
}
```

---

## Notes

- **Authentication**: All routes require JWT token in cookie
- **Role-Based Access**: 
  - Candidates can only see their own submissions and sample test cases
  - Recruiters/Admins can see all data
- **Interview Status**: Must be "active" to accept submissions
- **Plagiarism Hash**: Automatically computed for each submission
- **Execution**: Currently returns dummy responses (Judge0 integration pending)
