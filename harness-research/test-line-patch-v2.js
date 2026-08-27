/**
 * @fileoverview Unit Test Suite for Safe Line Patch V2
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { executeLinePatchV2, getSha256 } = require('./line-patch-v2.js');

const TEST_DIR = path.resolve(__dirname, '../tmp_test_patch_v2');

function setup() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

function testAll() {
  setup();
  console.log('--- Running Line Patch V2 Unit Tests ---');

  // Test 1: CRLF Preservation and single line edit
  const file1 = path.join(TEST_DIR, 'test_crlf.py');
  fs.writeFileSync(file1, 'def add(a, b):\r\n    return a - b\r\n', 'utf8');
  const sha1 = getSha256(file1);

  const res1 = executeLinePatchV2(TEST_DIR, {
    file_path: 'test_crlf.py',
    expected_sha256: sha1,
    edits: [{ start_line: 2, end_line: 2, expected_old: '    return a - b', replacement: '    return a + b' }],
  });
  assert.strictEqual(res1.success, true);
  const content1 = fs.readFileSync(file1, 'utf8');
  assert.strictEqual(content1, 'def add(a, b):\r\n    return a + b\r\n');
  console.log('✓ Test 1: CRLF Preservation & Single Line Edit PASSED');

  // Test 2: Bottom-to-Top Multi-Edit without line shift
  const file2 = path.join(TEST_DIR, 'test_multi.py');
  fs.writeFileSync(file2, 'line 1\nline 2\nline 3\nline 4\nline 5\n', 'utf8');
  const sha2 = getSha256(file2);

  const res2 = executeLinePatchV2(TEST_DIR, {
    file_path: 'test_multi.py',
    expected_sha256: sha2,
    edits: [
      { start_line: 2, end_line: 2, expected_old: 'line 2', replacement: 'line 2.1\nline 2.2' },
      { start_line: 4, end_line: 4, expected_old: 'line 4', replacement: 'line 4.new' },
    ],
  });
  assert.strictEqual(res2.success, true);
  const content2 = fs.readFileSync(file2, 'utf8');
  assert.strictEqual(content2, 'line 1\nline 2.1\nline 2.2\nline 3\nline 4.new\nline 5\n');
  console.log('✓ Test 2: Bottom-to-Top Multi-Edit PASSED');

  // Test 3: Stale File Check
  const res3 = executeLinePatchV2(TEST_DIR, {
    file_path: 'test_multi.py',
    expected_sha256: 'STALE_HASH_12345',
    edits: [{ start_line: 1, end_line: 1, expected_old: 'line 1', replacement: 'new line 1' }],
  });
  assert.strictEqual(res3.success, false);
  assert.strictEqual(res3.error, 'STALE_FILE');
  console.log('✓ Test 3: Stale File Protection PASSED');

  // Test 4: Expected Old Mismatch
  const sha2_updated = getSha256(file2);
  const res4 = executeLinePatchV2(TEST_DIR, {
    file_path: 'test_multi.py',
    expected_sha256: sha2_updated,
    edits: [{ start_line: 1, end_line: 1, expected_old: 'WRONG TEXT', replacement: 'new line 1' }],
  });
  assert.strictEqual(res4.success, false);
  assert.strictEqual(res4.error, 'EXPECTED_OLD_MISMATCH');
  console.log('✓ Test 4: Expected Old Pre-Validation PASSED');

  // Test 5: Out of bounds line range
  const res5 = executeLinePatchV2(TEST_DIR, {
    file_path: 'test_multi.py',
    expected_sha256: sha2_updated,
    edits: [{ start_line: 100, end_line: 105, replacement: 'out of bounds' }],
  });
  assert.strictEqual(res5.success, false);
  assert.ok(res5.error.startsWith('INVALID_LINE_RANGE'));
  console.log('✓ Test 5: Invalid Line Range PASSED');

  // Test 6: Sandbox Confinement
  const res6 = executeLinePatchV2(TEST_DIR, {
    file_path: '../../outside.txt',
    edits: [{ start_line: 1, end_line: 1, replacement: 'hack' }],
  });
  assert.strictEqual(res6.success, false);
  assert.ok(res6.error.startsWith('SECURITY_ERROR'));
  console.log('✓ Test 6: Sandbox Security Boundary PASSED');

  teardown();
  console.log('ALL LINE PATCH V2 UNIT TESTS PASSED SUCCESSFULLY!\n');
}

testAll();
