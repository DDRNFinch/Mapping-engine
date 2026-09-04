(()=>{"use strict";
if(typeof require!=="function")throw new Error("Node build loader required for Naxos question-bank engine v5.");
require("./question-bank-engine-v6.js");
require("./question-bank-engine-v7.js");
if(!globalThis.NaxosQuestionBankV7?.build)throw new Error("NaxosQuestionBankV7 did not initialise.");
globalThis.NaxosQuestionBankV5=globalThis.NaxosQuestionBankV7;
})();
