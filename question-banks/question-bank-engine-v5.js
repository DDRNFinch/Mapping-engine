(()=>{"use strict";
if(typeof require!=="function")throw new Error("Node build loader required for Naxos question-bank engine v5.");
require("./question-bank-engine-v6.js");
if(!globalThis.NaxosQuestionBankV6?.build)throw new Error("NaxosQuestionBankV6 did not initialise.");
globalThis.NaxosQuestionBankV5=globalThis.NaxosQuestionBankV6;
})();
