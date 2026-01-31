import { test } from 'node:test';
import assert from 'node:assert';
import { extractStackTraces } from '../src/brief.js';

test('extractStackTraces identifies Java stack traces', () => {
  const input = `
I encountered this error in the logs:

java.lang.NullPointerException: Something went wrong
    at com.example.myproject.Book.getTitle(Book.java:16)
    at com.example.myproject.Author.getBookTitles(Author.java:25)
    at com.example.myproject.Main.main(Main.java:10)

And also this one:

java.lang.IllegalArgumentException
    at java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1144)
    at java.base/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)
    at java.base/java.lang.Thread.run(Thread.java:1589)

End of logs.
`;
  
  const result = extractStackTraces(input);
  
  // Should find 2 valid stack traces
  assert.strictEqual(result.length, 2);
  
  assert.ok(result[0].startsWith('java.lang.NullPointerException'));
  assert.ok(result[0].includes('at com.example.myproject.Book.getTitle(Book.java:16)'));
  
  assert.ok(result[1].startsWith('java.lang.IllegalArgumentException'));
  assert.ok(result[1].includes('at java.base/java.util.concurrent.ThreadPoolExecutor.runWorker'));
});
