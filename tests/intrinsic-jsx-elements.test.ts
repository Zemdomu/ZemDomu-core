import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("intrinsic JSX element detection", () => {
  it("does not apply native document or table rules to custom components", () => {
    const results = lint(`export default () => (
      <Html>
        <Head><Title /></Head>
        <Main />
        <Table />
        <Section />
        <H3 />
      </Html>
    );`);

    for (const rule of [
      "requireDocumentTitle",
      "requireSingleMain",
      "requireTableCaption",
      "requireSectionHeading",
      "enforceHeadingOrder",
      "singleH1",
    ]) {
      assert.ok(!results.some((result) => result.rule === rule), rule);
    }
  });

  it("allows a native table wrapper to forward children through spread props", () => {
    const results = lint(`export default ({ props }) => <table {...props} />;`);
    assert.ok(!results.some((result) => result.rule === "requireTableCaption"));
  });
});
