declare const testCases: {
    valid: {
        basicValid: string;
        withMarkdown: string;
        minimalValid: string;
    };
    positionErrors: {
        position1LeadingComma: string;
        position2AfterNewline: string;
        wrongBracketStart: string;
        unexpectedChar: string;
        doubleCommaStart: string;
    };
    trailingCommas: {
        objectTrailing: string;
        arrayTrailing: string;
        multipleTrailing: string;
    };
    malformed: {
        unquotedKeys: string;
        singleQuotes: string;
        missingQuotes: string;
        extraCommas: string;
    };
    edgeCases: {
        emptyInput: string;
        onlyBraces: string;
        missingClosingBrace: string;
        missingOpeningBrace: string;
        nestedMarkdown: string;
        malformedMarkdown: string;
        noJsonFound: string;
        veryLargeFile: string;
    };
    realWorld: {
        aiGeneratedWithErrors: string;
        incompleteGeneration: string;
        truncatedJson: string;
        withComments: string;
    };
};
declare function runTest(category: string, testName: string, input: string, shouldPass?: boolean): void;
declare function runQuickTests(): void;
declare function runFullTests(): void;
declare function testSpecificIssue(input: string): void;
declare function testJsonFixesExtended(): void;
export { runQuickTests, runFullTests, testSpecificIssue, testJsonFixesExtended, runTest, testCases };
