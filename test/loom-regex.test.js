
import { extractLoomMetadataFromHtml } from '../src/providers/loom.js';
import assert from 'assert';
import { test } from 'node:test';

test('extractLoomMetadataFromHtml handles nested JSON correctly', () => {
    const json = JSON.stringify({
        "ROOT_QUERY": {
            "__typename": "Query",
            "viewer": { "__ref": "User:123" }
        },
        "User:123": {
            "id": "123",
            "name": "Test User",
            "nested": { "a": 1, "b": 2 }
        },
        "RegularUserVideo:12345": {
            "id": "12345",
            "name": "Test Video",
            "createdAt": "2023-01-01T00:00:00.000Z",
             "posterUrl": "http://example.com/poster.jpg"
        }
    });

    const html = `
    <html>
    <script>
    window.__APOLLO_STATE__ = ${json};
    </script>
    </html>
    `;

    // The current regex is /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/
    // This will likely match "{ "ROOT_QUERY": { "__typename": "Query", "viewer": { "__ref": "User:123" }" and stop at the first closing brace if not careful, 
    // OR it might work if the regex engine backtracks correctly? 
    // Actually, *? is non-greedy. It will stop at the FIRST "};". 
    // In the JSON above, "viewer": { "__ref": "User:123" } ends with "}". 
    // But we are looking for "};" (semicolon).
    // The JSON string doesn't end with ; inside. 
    // But what if the JSON contains "};" string inside?
    // Let's assume standard simple case first.

    // Wait, the regex expects `};` at the end.
    // JSON.stringify output does NOT end with semicolon.
    // The script tag content adds it.
    
    // If I have nested objects: { "a": { "b": 1 } };
    // The first "}" is after 1. The next is after "b": 1 }. 
    // The regex `\{[\s\S]*?\};` will match until the FIRST `};`.
    // If the JSON itself contains `};` inside a string, it breaks.
    // But standard JSON structure:
    // { ... } ; 
    // The closing brace of the JSON object + semicolon.
    
    // Is it possible for `}` to appear followed by `;` inside the JSON? 
    // Unlikely in normal keys/values unless crafted.
    
    // BUT, is the non-greedy match `*?` combined with `};` enough?
    // Yes, because `}` inside the JSON is rarely followed by `;` unless it's the end of the statement.
    // However, if the JSON is compressed and there's code after it?
    // ... = {...};foo();
    
    // Let's stick to the current implementation for a second.
    // Maybe I should add a test that explicitly tries to break it with nested objects just to be sure.
    
    // Actually, looking at `src/loom.js`:
    // const m = s.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
    // state = JSON.parse(m[1]);
    
    // If m[1] is truncated, JSON.parse will throw.
    
    // Let's verify if the regex works on a complex nested object.
    
    try {
        const result = extractLoomMetadataFromHtml(html);
        assert.notEqual(result, null, 'Should extract state');
    } catch (e) {
        assert.fail('Parsing failed: ' + e.message);
    }
});
