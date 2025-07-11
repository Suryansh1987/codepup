"use strict";
// Comprehensive test suite for the enhanced parser
// Copy this to test-enhanced-parser.ts and run with your parser
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCases = void 0;
exports.runQuickTests = runQuickTests;
exports.runFullTests = runFullTests;
exports.testSpecificIssue = testSpecificIssue;
exports.testJsonFixesExtended = testJsonFixesExtended;
exports.runTest = runTest;
const newparser_1 = require("./newparser"); // Update this path
// Test cases covering various scenarios
const testCases = {
    // Valid cases that should work
    valid: {
        basicValid: `
{
  "codeFiles": {
    "tailwind.config.ts": "export default {\\n  content: ['./src/**/*.{js,ts,jsx,tsx}'],\\n  theme: {\\n    extend: {\\n      colors: {\\n        primary: '#ff6b35'\\n      }\\n    }\\n  }\\n}",
    "App.tsx": "import React from 'react';\\n\\nfunction App() {\\n  return <div>Hello</div>;\\n}\\n\\nexport default App;"
  },
  "structureTree": {
    "tailwind.config.ts": "file",
    "src": {
      "App.tsx": "file"
    }
  }
}`,
        withMarkdown: `
\`\`\`json
{
  "codeFiles": {
    "App.tsx": "import React from 'react';\\n\\nconst App = () => <div>Test</div>;\\n\\nexport default App;"
  },
  "structureTree": {
    "src": {
      "App.tsx": "file"
    }
  }
}
\`\`\``,
        minimalValid: `{"codeFiles": {"test.ts": "console.log('test');"}, "structureTree": {"src": {"test.ts": "file"}}}`
    },
    // Position errors (the main issue you're facing)
    positionErrors: {
        position1LeadingComma: `{, "codeFiles": {}, "structureTree": {}}`,
        position2AfterNewline: `{
, "codeFiles": {}, "structureTree": {}}`,
        wrongBracketStart: `{] "codeFiles": {}, "structureTree": {}}`,
        unexpectedChar: `{# "codeFiles": {}, "structureTree": {}}`,
        doubleCommaStart: `{,, "codeFiles": {}, "structureTree": {}}`
    },
    // Trailing comma issues
    trailingCommas: {
        objectTrailing: `{
  "codeFiles": {
    "App.tsx": "test",
  },
  "structureTree": {
    "src": {
      "App.tsx": "file",
    },
  }
}`,
        arrayTrailing: `{
  "codeFiles": {
    "package.json": "{\\"dependencies\\": [\\"react\\", \\"typescript\\",]}"
  },
  "structureTree": {}
}`,
        multipleTrailing: `{
  "codeFiles": {
    "test.ts": "console.log();",
  },
  "structureTree": {
    "src": {
      "test.ts": "file",
    },
  },
}`
    },
    // Malformed JSON patterns
    malformed: {
        unquotedKeys: `{
  codeFiles: {
    "App.tsx": "test"
  },
  structureTree: {}
}`,
        singleQuotes: `{
  'codeFiles': {
    'App.tsx': 'test content'
  },
  'structureTree': {}
}`,
        missingQuotes: `{
  "codeFiles": {
    App.tsx: "test"
  },
  "structureTree": {}
}`,
        extraCommas: `{
  "codeFiles": {
    "App.tsx": "test",,
    "test.ts": "more"
  },
  "structureTree": {}
}`
    },
    // Edge cases
    edgeCases: {
        emptyInput: ``,
        onlyBraces: `{}`,
        missingClosingBrace: `{"codeFiles": {}, "structureTree": {}`,
        missingOpeningBrace: `"codeFiles": {}, "structureTree": {}}`,
        nestedMarkdown: `
Some text before
\`\`\`json
{
  "codeFiles": {},
  "structureTree": {}
}
\`\`\`
Some text after`,
        malformedMarkdown: `
\`\`\`json
{, "codeFiles": {}, "structureTree": {}}
\`\`\``,
        noJsonFound: `This is just plain text with no JSON at all`,
        veryLargeFile: `{
  "codeFiles": {
    ${'    '.repeat(1000)}"App.tsx": "${'x'.repeat(10000)}"
  },
  "structureTree": {"src": {"App.tsx": "file"}}
}`
    },
    // Real-world problematic cases
    realWorld: {
        aiGeneratedWithErrors: `
Here's your burger restaurant website:

\`\`\`json
{,
  "codeFiles": {
    "tailwind.config.ts": "export default {\\n  content: ['./src/**/*.{js,ts,jsx,tsx}'],\\n  theme: {\\n    extend: {\\n      colors: {\\n        red: {\\n          500: '#ef4444',\\n          600: '#dc2626'\\n        }\\n      }\\n    }\\n  }\\n}",
    "App.tsx": "import React from 'react';\\nimport { BrowserRouter } from 'react-router-dom';\\n\\nfunction App() {\\n  return (\\n    <BrowserRouter>\\n      <div>Burger App</div>\\n    </BrowserRouter>\\n  );\\n}\\n\\nexport default App;",
  },
  "structureTree": {
    "tailwind.config.ts": "file",
    "src": {
      "App.tsx": "file",
    }
  }
}
\`\`\`

This creates a complete burger restaurant website.`,
        incompleteGeneration: `{
  "codeFiles": {
    "App.tsx": "import React from 'react'`,
        truncatedJson: `{
  "codeFiles": {
    "App.tsx": "test"
  },
  "structureTree": {
    "src": {
      "App.tsx": "file"
    }
  `,
        withComments: `{
  // This is a comment that shouldn't be here
  "codeFiles": {
    "App.tsx": "test"
  },
  "structureTree": {}
}`
    }
};
exports.testCases = testCases;
function runTest(category, testName, input, shouldPass = true) {
    console.log(`\n=== ${category.toUpperCase()}: ${testName} ===`);
    console.log(`Expected to ${shouldPass ? 'PASS' : 'FAIL'}`);
    // Test with regular parser
    console.log('\n--- Testing with parseFrontendCode ---');
    try {
        const result = (0, newparser_1.parseFrontendCode)(input);
        if (shouldPass) {
            console.log('✅ SUCCESS: Regular parser worked');
            console.log(`Files: ${result.codeFiles.length}, Structure keys: ${Object.keys(result.structure).length}`);
        }
        else {
            console.log('❌ UNEXPECTED: Regular parser should have failed but passed');
        }
    }
    catch (error) {
        if (!shouldPass) {
            console.log('✅ EXPECTED FAILURE: Regular parser failed as expected');
            //@ts-ignore
            console.log(`Error: ${error.message}`);
        }
        else {
            console.log('❌ UNEXPECTED FAILURE: Regular parser failed when it should succeed');
            //@ts-ignore
            console.log(`Error: ${error.message}`);
        }
    }
    // Test with robust parser
    console.log('\n--- Testing with parseFrontendCodeRobust ---');
    try {
        const result = (0, newparser_1.parseFrontendCodeRobust)(input);
        console.log('✅ SUCCESS: Robust parser worked!');
        console.log(`Files: ${result.codeFiles.length}, Structure keys: ${Object.keys(result.structure).length}`);
        //@ts-ignore
        result.codeFiles.slice(0, 2).forEach(file => {
            console.log(`  - ${file.path}: ${file.content.length} chars`);
        });
    }
    catch (error) {
        console.log('❌ FAILURE: Even robust parser failed');
        //@ts-ignore
        console.log(`Error: ${error.message}`);
        // Run detailed analysis on failures
        console.log('\n--- Detailed Analysis ---');
        try {
            (0, newparser_1.debugInput)(input);
        }
        catch (debugError) {
            //@ts-ignore
            console.log('Debug analysis also failed:', debugError.message);
        }
    }
}
function runQuickTests() {
    console.log('🚀 Running Quick Test Suite...\n');
    // Test a few key cases
    runTest('valid', 'basicValid', testCases.valid.basicValid, true);
    runTest('positionErrors', 'position1LeadingComma', testCases.positionErrors.position1LeadingComma, false);
    runTest('trailingCommas', 'objectTrailing', testCases.trailingCommas.objectTrailing, true);
    runTest('malformed', 'unquotedKeys', testCases.malformed.unquotedKeys, false);
    runTest('realWorld', 'aiGeneratedWithErrors', testCases.realWorld.aiGeneratedWithErrors, false);
}
function runFullTests() {
    console.log('🧪 Running Full Test Suite...\n');
    // Test all categories
    Object.entries(testCases).forEach(([category, tests]) => {
        Object.entries(tests).forEach(([testName, input]) => {
            const shouldPass = category === 'valid';
            runTest(category, testName, input, shouldPass);
        });
    });
}
function testSpecificIssue(input) {
    console.log('🔍 Testing Specific Issue...\n');
    console.log('Input preview:');
    console.log(input.substring(0, 200) + (input.length > 200 ? '...' : ''));
    // First, analyze the input
    console.log('\n--- Input Analysis ---');
    (0, newparser_1.debugInput)(input);
    // Try to extract and analyze JSON
    try {
        console.log('\n--- JSON Extraction Test ---');
        const extracted = input.substring(input.indexOf('{'), input.lastIndexOf('}') + 1);
        console.log('Extracted JSON preview:', extracted.substring(0, 100));
        console.log('\n--- JSON Structure Analysis ---');
        (0, newparser_1.analyzeJsonStructure)(extracted);
        console.log('\n--- Testing Fixes ---');
        const fixed = (0, newparser_1.fixCommonJsonIssues)(extracted);
        console.log('Fixed JSON preview:', fixed.substring(0, 100));
        if (fixed !== extracted) {
            console.log('✅ Fixes were applied');
            try {
                JSON.parse(fixed);
                console.log('✅ Fixed JSON is valid!');
            }
            catch (error) {
                //@ts-ignore
                console.log('❌ Fixed JSON still invalid:', error.message);
            }
        }
        else {
            console.log('❌ No fixes could be applied');
        }
    }
    catch (error) {
        //@ts-ignore
        console.log('❌ Analysis failed:', error.message);
    }
    // Finally, test with both parsers
    console.log('\n--- Parser Tests ---');
    runTest('custom', 'userInput', input, true);
}
function testJsonFixesExtended() {
    console.log('\n🔧 Testing JSON Fix Functions...\n');
    (0, newparser_1.testJsonFixes)(); // Run the built-in tests
    // Additional fix tests
    const additionalTests = [
        '{, "test": "value", "other": "val",}', // Multiple issues
        '{\n, "nested": { "prop": "val",\n},}', // Complex nesting with issues
        `{ 'single': 'quotes', "mixed": 'types'}`, // Mixed quote types
        '{ unquoted: "key", "other": value}', // Mixed quoted/unquoted
    ];
    console.log('\n--- Additional Fix Tests ---');
    additionalTests.forEach((test, index) => {
        console.log(`\nAdditional Test ${index + 1}: ${JSON.stringify(test)}`);
        try {
            const fixed = (0, newparser_1.fixCommonJsonIssues)(test);
            console.log(`Fixed: ${JSON.stringify(fixed)}`);
            JSON.parse(fixed);
            console.log('✅ Successfully fixed and parsed');
        }
        catch (error) {
            //@ts-ignore
            console.log('❌ Fix failed:', error.message);
        }
    });
}
// If running this file directly
if (typeof require !== 'undefined' && require.main === module) {
    console.log('Choose a test to run:');
    console.log('1. Quick tests (recommended)');
    console.log('2. Full test suite');
    console.log('3. JSON fix tests');
    console.log('');
    // Run quick tests by default
    runQuickTests();
    console.log('\n💡 To test your specific problematic input:');
    console.log('   testSpecificIssue(yourInputString)');
    console.log('\n💡 To run all tests:');
    console.log('   runFullTests()');
}
/*
USAGE INSTRUCTIONS:

1. Basic testing:
   import { runQuickTests } from './test-enhanced-parser';
   runQuickTests();

2. Test your specific failing input:
   import { testSpecificIssue } from './test-enhanced-parser';
   testSpecificIssue(`your actual problematic JSON here`);

3. Full comprehensive testing:
   import { runFullTests } from './test-enhanced-parser';
   runFullTests();

4. Test just the JSON fixing:
   import { testJsonFixesExtended } from './test-enhanced-parser';
   testJsonFixesExtended();

This will help you identify exactly what's wrong with your JSON and whether
the enhanced parser can fix it automatically.
*/ 
//# sourceMappingURL=test.js.map