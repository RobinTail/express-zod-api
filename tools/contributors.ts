const users = new Set([
  "rottmann",
  "boarush",
  "daniel-white",
  "kotsmile",
  "arlyon",
  "elee1766",
  "danclaytondev",
  "huyhoang160593",
  "sarahssharkey",
  "shawncarr",
  "alindsay55661",
  "john-schmitz",
  "bobgubko",
  "miki725",
  "dev-m1-macbook",
  "McMerph",
  "shroudedcode",
  "maxcohn",
  "VideoSystemsTech",
  "TheWisestOne",
  "lazylace37",
  "leosuncin",
  "kirdk",
  "rayzr522",
]);

const markdown = Array.from(users)
  .map(
    (user) =>
      `[<img src="https://github.com/${user}.png" alt="@${user}" width="50px" />](https://github.com/${user})`,
  )
  .join("\n");

console.log(markdown);
