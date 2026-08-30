const assert = require('assert');
const { lint } = require('../out/index');

const failures = [
  '<button></button>',
  '<button aria-label=""></button>',
  '<button aria-labelledby="missing"></button>',
  '<button aria-labelledby="empty"></button><span id="empty"></span>',
  '<button><svg></svg></button>',
  '<button><span aria-hidden="true">Hidden</span></button>',
  '<button><span hidden>Hidden</span></button>',
];

failures.forEach((html, idx) => {
  const results = lint(html);
  assert.ok(
    results.some(r => r.rule === 'requireButtonText'),
    `Expected button text warning for failure case ${idx + 1}`
  );
});

const passes = [
  '<button aria-label="Close"></button>',
  '<span id="label">Close</span><button aria-labelledby="label"></button>',
  '<button><span>Save</span></button>',
  '<button><img alt="Close" /></button>',
  '<button><span class="sr-only">Hidden label</span></button>',
  '<button title="Close"></button>',
  '<button :title="closeLabel"></button>',
];

passes.forEach((html, idx) => {
  const results = lint(html);
  assert.ok(
    !results.some(r => r.rule === 'requireButtonText'),
    `Did not expect button text warning for pass case ${idx + 1}`
  );
});

console.log('button-accessibility tests passed');
