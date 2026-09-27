import test from 'node:test';import assert from 'node:assert/strict';
import {nativeTau} from '../src/research/native-tau-v10.mjs';
test('a missing optional Python runtime fails and closes without hanging the caller',async()=>{
 const bridge=nativeTau({python:'missing-native-tau-python-test-executable'});
 await assert.rejects(bridge.call({command:'init',domain:'retail'}));
 await bridge.close();await bridge.close();
 await assert.rejects(bridge.call({command:'snapshot'}));
});
