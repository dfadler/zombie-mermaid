# @zombie-mermaid/cli

## 5.18.0

### Minor Changes

- [#3133](https://github.com/dfadler/zombie-mermaid/pull/3133) [`9d0e5ee`](https://github.com/dfadler/zombie-mermaid/commit/9d0e5ee94f195949230e03643cd562620405a435) Thanks [@dfadler](https://github.com/dfadler)! - Use case diagrams: `usecase-beta` (the only header mermaid@12.3.0 detects) now renders to SVG and ASCII. Actors, use cases (`Name`, `Name(label)`, `Name[label]`), `systemBoundary`, `direction`, associations with labels, `include`/`extend`/generalization and `note for` are supported; metadata, stereotypes, classes, `json` nodes, circle/cross markers and edge ids are rejected with a "not supported yet" error. `parseUsecase` and `usecaseToGraph` join `@zombie-mermaid/mermaid-parser`; `DiagramType` gains `'usecase'`, `NodeShape` gains the `usecase-*` shapes and an edge `triangle` terminator.

### Patch Changes

- Updated dependencies [[`8d4b3e8`](https://github.com/dfadler/zombie-mermaid/commit/8d4b3e83a8c5bca97ce67ae00c05efb9c6e185db), [`68abaac`](https://github.com/dfadler/zombie-mermaid/commit/68abaacc88073779b079acf9653108a02f6d7987), [`29510b3`](https://github.com/dfadler/zombie-mermaid/commit/29510b303552a316e136a390e3d44c50ab03bf52), [`01169d4`](https://github.com/dfadler/zombie-mermaid/commit/01169d476c757cc89318ca180afee28e4f7268e4), [`be2f550`](https://github.com/dfadler/zombie-mermaid/commit/be2f55069eb5533bff802b0cc7623c991c896503), [`fce6493`](https://github.com/dfadler/zombie-mermaid/commit/fce6493a31810e0c28d4c33dc43e80839611a34e), [`adf3ab1`](https://github.com/dfadler/zombie-mermaid/commit/adf3ab1d530f86ed43b53251c06f34f60b6ab9b3), [`9d0e5ee`](https://github.com/dfadler/zombie-mermaid/commit/9d0e5ee94f195949230e03643cd562620405a435), [`597a68f`](https://github.com/dfadler/zombie-mermaid/commit/597a68f868224ee82aae6896150d21a9042feba4), [`3cad98a`](https://github.com/dfadler/zombie-mermaid/commit/3cad98ac0b99ab7af44d2806ac23f2d2c11e33d3)]:
  - @zombie-mermaid/ascii-renderer@5.18.0
  - @zombie-mermaid/svg-renderer@5.18.0
  - @zombie-mermaid/core@5.18.0
  - @zombie-mermaid/mcp@5.18.0

## 5.17.0

### Patch Changes

- Updated dependencies [[`a1e1732`](https://github.com/dfadler/zombie-mermaid/commit/a1e1732abcb39034731037993fae296fc11bf269), [`529a6a9`](https://github.com/dfadler/zombie-mermaid/commit/529a6a939cbd41d26fe37aeaad993b4445783807), [`a2a3cdc`](https://github.com/dfadler/zombie-mermaid/commit/a2a3cdc8e8f0bd342797b77ed88601f95686cc8b), [`a217c9b`](https://github.com/dfadler/zombie-mermaid/commit/a217c9b5c324d13207578d577f62f1a4b4bf866c), [`2c3fb2a`](https://github.com/dfadler/zombie-mermaid/commit/2c3fb2a705ea564d6f2b9ddf9b4c7a4b613df1f2), [`d46be97`](https://github.com/dfadler/zombie-mermaid/commit/d46be972452862fab3f58918342d27a4dcea6c05), [`f231428`](https://github.com/dfadler/zombie-mermaid/commit/f2314289bcdbe0ca0f4460821a84decd42d80c58), [`7536a42`](https://github.com/dfadler/zombie-mermaid/commit/7536a426cbc5c6a3720d275eded9bfd7b3f2e7c4), [`9873186`](https://github.com/dfadler/zombie-mermaid/commit/9873186b44b457204219609c11b4c2da1d501178), [`2cf8c43`](https://github.com/dfadler/zombie-mermaid/commit/2cf8c43e16de7c00b2cc7bc215f5638c282e9b91), [`1e85aab`](https://github.com/dfadler/zombie-mermaid/commit/1e85aab0831db93bbd0e650b09a0e269bdb0cd1f), [`9163912`](https://github.com/dfadler/zombie-mermaid/commit/9163912fb6bcfeb8059f9b1c6d2c45b611949545), [`4e66805`](https://github.com/dfadler/zombie-mermaid/commit/4e668056685efc8a3ca3af6b5721cef725b5960a), [`dcdb714`](https://github.com/dfadler/zombie-mermaid/commit/dcdb71488632e2e6896609c66f64c66fc384056d), [`1ea909e`](https://github.com/dfadler/zombie-mermaid/commit/1ea909e1673451a623633e43e87bc706021f49bc), [`d398275`](https://github.com/dfadler/zombie-mermaid/commit/d398275649cd3f5ecb011a8ad6179a45249a4963), [`ef6160a`](https://github.com/dfadler/zombie-mermaid/commit/ef6160a8208c8048b9a4af8585997d1171c1fffb), [`29e8950`](https://github.com/dfadler/zombie-mermaid/commit/29e895032e7ab9b81606e8d33204107ebb9afd8e), [`12d01bd`](https://github.com/dfadler/zombie-mermaid/commit/12d01bd9a03b5ab43e8bbd974e808fcc51c09e3a), [`0974fd6`](https://github.com/dfadler/zombie-mermaid/commit/0974fd669c37b01c37047563bf7a3837490bd1f4), [`3126f3e`](https://github.com/dfadler/zombie-mermaid/commit/3126f3e5807124a865292a4df04c0bf5473e5457), [`d48bea7`](https://github.com/dfadler/zombie-mermaid/commit/d48bea799a40ae7075a94fe2b7623a8e3af63a4c), [`f09d884`](https://github.com/dfadler/zombie-mermaid/commit/f09d88477a8360dfbb45186e6d6fe9f648c075be), [`2afa86d`](https://github.com/dfadler/zombie-mermaid/commit/2afa86ddb4ca0f5a99e180fecdcd9ca9a008bbac), [`5b61a20`](https://github.com/dfadler/zombie-mermaid/commit/5b61a201cf86b4a8950471dcb84ec270aed04bba), [`192d0d7`](https://github.com/dfadler/zombie-mermaid/commit/192d0d7f0b214c05bd33be1c0ebc585d95ecd7c8), [`f3daa87`](https://github.com/dfadler/zombie-mermaid/commit/f3daa87e852386ad049660082438cd000b9e7e49), [`3b4e15e`](https://github.com/dfadler/zombie-mermaid/commit/3b4e15e78cad94193eac23235e08c2233648adf6), [`bb94508`](https://github.com/dfadler/zombie-mermaid/commit/bb94508c19a18b88ee9c844a43552ee2115327d1), [`cb326ab`](https://github.com/dfadler/zombie-mermaid/commit/cb326abd9cdcc2b38d451b46e5e1f9754ceeab8f), [`d6e8e80`](https://github.com/dfadler/zombie-mermaid/commit/d6e8e80fa6aeaf203b843c858dd91d344eca2ef9), [`fdbe69c`](https://github.com/dfadler/zombie-mermaid/commit/fdbe69c3114289df48482296832276340df57312), [`989f8c5`](https://github.com/dfadler/zombie-mermaid/commit/989f8c5bf94f6ae9140b343317cfb949e155fde5), [`9730760`](https://github.com/dfadler/zombie-mermaid/commit/97307606dca07eeeb739e1c1a7720f5532a088af), [`a40f41b`](https://github.com/dfadler/zombie-mermaid/commit/a40f41b176094ba3c22d1036fdc3065c0130808e), [`6ffa2aa`](https://github.com/dfadler/zombie-mermaid/commit/6ffa2aaa849f3087f5112929c37c851c372ae488), [`786ca96`](https://github.com/dfadler/zombie-mermaid/commit/786ca96e0cbd3e4f2863331510fd0ae91e14e5be), [`f15a155`](https://github.com/dfadler/zombie-mermaid/commit/f15a1559cb7c720cbde4314aec255b3112a9db44), [`f7506e9`](https://github.com/dfadler/zombie-mermaid/commit/f7506e9021ac8f9dc3ee8fdb6c592a146b7a35c6), [`c82a0e6`](https://github.com/dfadler/zombie-mermaid/commit/c82a0e670f2756d24050019b3a8bf461f9d49259), [`acc6c90`](https://github.com/dfadler/zombie-mermaid/commit/acc6c90dfb956209a77ffe7a120054dc9a451940), [`cf94f85`](https://github.com/dfadler/zombie-mermaid/commit/cf94f85a72a3a363955a76b465f823f97001aed3), [`18f3cd3`](https://github.com/dfadler/zombie-mermaid/commit/18f3cd33859bc2e43bfce191012cd8a11fb3eabe)]:
  - @zombie-mermaid/svg-renderer@5.17.0
  - @zombie-mermaid/ascii-renderer@5.17.0
  - @zombie-mermaid/core@5.17.0
  - @zombie-mermaid/mcp@5.17.0

## 5.16.0

### Patch Changes

- Updated dependencies [[`e3f022e`](https://github.com/dfadler/zombie-mermaid/commit/e3f022e47168c7aba785964e79b272158c31b728), [`5a698d9`](https://github.com/dfadler/zombie-mermaid/commit/5a698d91b9ffa3f2bbb1078a4e8533d896847a18), [`f492dba`](https://github.com/dfadler/zombie-mermaid/commit/f492dba9e381c987eb5a1d3cef4ed791c65e51c6), [`5d33cf6`](https://github.com/dfadler/zombie-mermaid/commit/5d33cf66bf023c56a07304a4dbd6d78528ac4e6d), [`806f196`](https://github.com/dfadler/zombie-mermaid/commit/806f1963185de1252d28b1e3f695360306638915), [`2cf6d59`](https://github.com/dfadler/zombie-mermaid/commit/2cf6d5995f87f4e131f8f7d85c549fdda17390e1), [`1fb07de`](https://github.com/dfadler/zombie-mermaid/commit/1fb07de5a3f40d41f969d187047d77f5e8878dcc), [`2d60e16`](https://github.com/dfadler/zombie-mermaid/commit/2d60e16c3edc9ae813cbb53115e78656d0dfeb9e), [`1669929`](https://github.com/dfadler/zombie-mermaid/commit/16699292b6c40d64389b0af3b245d533a3c9d062), [`f367d17`](https://github.com/dfadler/zombie-mermaid/commit/f367d1750941f59970f576a5cf09676961b04568), [`e7d7d2c`](https://github.com/dfadler/zombie-mermaid/commit/e7d7d2cccb5329adabe73dd3adae735f8ade01fd), [`c488abb`](https://github.com/dfadler/zombie-mermaid/commit/c488abbd4e228b0ec3fba06578b6836405faf3ba), [`e42a5a9`](https://github.com/dfadler/zombie-mermaid/commit/e42a5a9b8505ddde902111134d3d4101eeb3d9e3), [`e28a4ab`](https://github.com/dfadler/zombie-mermaid/commit/e28a4ab0477d230f4090ce7d6e1fdbf25679007e), [`321b62c`](https://github.com/dfadler/zombie-mermaid/commit/321b62c39a27c9abe45f21b45c36c8e7c115a7d4), [`85ef8be`](https://github.com/dfadler/zombie-mermaid/commit/85ef8beac209acfdbd19baaee6b7fdf59751579b), [`f89c807`](https://github.com/dfadler/zombie-mermaid/commit/f89c807f4ed05d985740039a12be7ac89aece6e4), [`9260605`](https://github.com/dfadler/zombie-mermaid/commit/9260605bb1b9925ab538163c18d83fa997a76f24), [`7f6b099`](https://github.com/dfadler/zombie-mermaid/commit/7f6b0993ff66237a43655f8d5018c5b5762eff99), [`ebf92ba`](https://github.com/dfadler/zombie-mermaid/commit/ebf92ba78774acbbe897a1b9b3f844fbd268e301), [`85f5358`](https://github.com/dfadler/zombie-mermaid/commit/85f5358545b0b48839f5807bf3fc28d08a1f0b00), [`fb1c36a`](https://github.com/dfadler/zombie-mermaid/commit/fb1c36a1e755e50c7f47971c0e0061e5f1648928), [`401c162`](https://github.com/dfadler/zombie-mermaid/commit/401c1625f0b1bdebb9edec520fdce9469e224bee), [`21946db`](https://github.com/dfadler/zombie-mermaid/commit/21946dbc377e7563ac3a3e42de900d1915298c61), [`350f601`](https://github.com/dfadler/zombie-mermaid/commit/350f601a97d1720569d044bc4010627b25f52207), [`e8e3670`](https://github.com/dfadler/zombie-mermaid/commit/e8e3670dac298876937f1df1440129bc65e9a7f8), [`8e59552`](https://github.com/dfadler/zombie-mermaid/commit/8e595527ed8bbfb9d1d6a3bfea95380a1e301511), [`00c9985`](https://github.com/dfadler/zombie-mermaid/commit/00c99856be807ef09dc2d8e1597c131b319e5543), [`61aeff9`](https://github.com/dfadler/zombie-mermaid/commit/61aeff995e00fff55443e416cc38dc90d67a4746), [`d5c3625`](https://github.com/dfadler/zombie-mermaid/commit/d5c362501a704a89249a3da26eb4da657fc90353)]:
  - @zombie-mermaid/svg-renderer@5.16.0
  - @zombie-mermaid/ascii-renderer@5.16.0
  - @zombie-mermaid/core@5.16.0
  - @zombie-mermaid/mcp@5.16.0

## 5.15.1

### Patch Changes

- Updated dependencies [[`5eaa786`](https://github.com/dfadler/zombie-mermaid/commit/5eaa786366045faf9bd6afaf566cf454e857d2f8), [`168bded`](https://github.com/dfadler/zombie-mermaid/commit/168bded9b0cac7127166ca7723e8d4f89f1fc599)]:
  - @zombie-mermaid/ascii-renderer@5.15.1
  - @zombie-mermaid/core@5.15.1
  - @zombie-mermaid/mcp@5.15.1
  - @zombie-mermaid/svg-renderer@5.15.1

## 5.15.0

### Patch Changes

- Updated dependencies [[`52a75e3`](https://github.com/dfadler/zombie-mermaid/commit/52a75e32701b110f851ec56de1a1241b4e63a037), [`634347a`](https://github.com/dfadler/zombie-mermaid/commit/634347a7c875042df68a5b97d83482580a1763a5), [`0b4ae8e`](https://github.com/dfadler/zombie-mermaid/commit/0b4ae8ef95cbb555a58fbc17b19c8b3e87112793), [`5b3dd4c`](https://github.com/dfadler/zombie-mermaid/commit/5b3dd4c792bec9e7496f1c871b7306923381d9b9), [`1aef4c5`](https://github.com/dfadler/zombie-mermaid/commit/1aef4c5dbb4a45b6e68b6a9167065d468fb248a4), [`60f0218`](https://github.com/dfadler/zombie-mermaid/commit/60f021857bd00fddf94ce5ea3bc57df5c31ab5c6), [`942337f`](https://github.com/dfadler/zombie-mermaid/commit/942337f91e31b0250a4503d34ea6512849eb25f0), [`557f31b`](https://github.com/dfadler/zombie-mermaid/commit/557f31b024dcaec290ee908b17cbc500354ffea7), [`116d560`](https://github.com/dfadler/zombie-mermaid/commit/116d560b1b928aad231468d5a6bc5d7cd70ba269), [`8918949`](https://github.com/dfadler/zombie-mermaid/commit/8918949c303ce770f144581a6a884360fa26760f), [`01c39fe`](https://github.com/dfadler/zombie-mermaid/commit/01c39fe054b57f89758a4f2dc2ee66aa2f018599), [`d4bfdbd`](https://github.com/dfadler/zombie-mermaid/commit/d4bfdbd53e7eefe9dd82c5288f5dd536e37e12d6), [`d779e3d`](https://github.com/dfadler/zombie-mermaid/commit/d779e3d1e3091e128241ce2c42b75ea201ece8a7), [`fd1aac8`](https://github.com/dfadler/zombie-mermaid/commit/fd1aac8d428fcdebf423da6176ee7da8228de904), [`fd681f1`](https://github.com/dfadler/zombie-mermaid/commit/fd681f186cb2849527c7fd6f6c527ee9b1212d23), [`b5c8509`](https://github.com/dfadler/zombie-mermaid/commit/b5c85093f706bb2d601f5033c2d713be7768db41), [`2f05f91`](https://github.com/dfadler/zombie-mermaid/commit/2f05f91708e7efd34da2242a8ab7e7fb01e99f07), [`1fb82c5`](https://github.com/dfadler/zombie-mermaid/commit/1fb82c5c070098d1d05daec460743afc666dde3b), [`18ee9d7`](https://github.com/dfadler/zombie-mermaid/commit/18ee9d757af407ca607036ab789f414335bb3b2e), [`113b6e6`](https://github.com/dfadler/zombie-mermaid/commit/113b6e6ddae73dcac444ac7e42ce39cf1be1a19d), [`469619d`](https://github.com/dfadler/zombie-mermaid/commit/469619df7feff78699d5a729ccea3c03333a5fc2), [`0b02507`](https://github.com/dfadler/zombie-mermaid/commit/0b025079795ff3facd444dc5daf10fe1c70bf2fd), [`5cda2fa`](https://github.com/dfadler/zombie-mermaid/commit/5cda2fa10e3add2c6774dafc036c1861400be15c), [`fb76e59`](https://github.com/dfadler/zombie-mermaid/commit/fb76e59915209a7a14a1a56cc5a6ed39b58d5453), [`38df6e9`](https://github.com/dfadler/zombie-mermaid/commit/38df6e9eaec89b833c6469d88ac3d2d4fb60e361), [`60d6fbb`](https://github.com/dfadler/zombie-mermaid/commit/60d6fbb12071720d400a770bac12a903b64cf0b5), [`8ab0afc`](https://github.com/dfadler/zombie-mermaid/commit/8ab0afc88baaf0e0e5ccb5773a5acefdf070f012), [`0cbb03b`](https://github.com/dfadler/zombie-mermaid/commit/0cbb03bb3f94ff464b4fa086f01e2dac85c12a23), [`07a8e00`](https://github.com/dfadler/zombie-mermaid/commit/07a8e000a1ba132c096a65a1821fdafcbb9f40d9), [`8d71ccd`](https://github.com/dfadler/zombie-mermaid/commit/8d71ccdf03577da58460c2f0cb8b26c09fc29f2f), [`a718cf6`](https://github.com/dfadler/zombie-mermaid/commit/a718cf693705ce01a8a3020d1c9ac4cbb502f9c5), [`703b154`](https://github.com/dfadler/zombie-mermaid/commit/703b154aef9231906561c2d6450739b7525ab40a), [`56e74ae`](https://github.com/dfadler/zombie-mermaid/commit/56e74aebda0cf0e703ac80117500c3bfff3e5e35), [`51d8994`](https://github.com/dfadler/zombie-mermaid/commit/51d8994a2293469f65d185880d284a03be52f491), [`dcd3b26`](https://github.com/dfadler/zombie-mermaid/commit/dcd3b260ad2b48c7743e901ca64d6c980722d688), [`d596505`](https://github.com/dfadler/zombie-mermaid/commit/d59650524fb0e63f0049e173172f6d581d143d01), [`947dc5f`](https://github.com/dfadler/zombie-mermaid/commit/947dc5fad8b6898dd3441f12badb1e7c5ca27245), [`681745d`](https://github.com/dfadler/zombie-mermaid/commit/681745d05f0cefb5ebb1f4246c11132d9453e41c), [`a711f58`](https://github.com/dfadler/zombie-mermaid/commit/a711f58fd2dccd871cb812ffddadf04ed64330b9), [`23f680d`](https://github.com/dfadler/zombie-mermaid/commit/23f680d5cc57a4661021229f46ec7e00b9caf7d0), [`c973f82`](https://github.com/dfadler/zombie-mermaid/commit/c973f82854cea602ac9aa29518be1115dba9aaa7), [`a08c1ac`](https://github.com/dfadler/zombie-mermaid/commit/a08c1ac88b3fea1b9d06bd6849a7543dd8862142), [`6fdbf16`](https://github.com/dfadler/zombie-mermaid/commit/6fdbf16284b19b7250f2adfd0f37a7a5179cdb39), [`2c77b71`](https://github.com/dfadler/zombie-mermaid/commit/2c77b71a240bfd6e83e8bb7b1f4d522d713ea599), [`bfed790`](https://github.com/dfadler/zombie-mermaid/commit/bfed79057d20e563635fc9a64cae5aba34d8172d), [`de9196a`](https://github.com/dfadler/zombie-mermaid/commit/de9196a64ba520295f6185bd0457c2a322c71de1), [`28b4510`](https://github.com/dfadler/zombie-mermaid/commit/28b45102a1ffa24771296f1e72d1617fd607710f), [`fe071e6`](https://github.com/dfadler/zombie-mermaid/commit/fe071e6fad9b8ec169a01a31495e62a828c38d5e), [`e152571`](https://github.com/dfadler/zombie-mermaid/commit/e1525714e54cb06411dc8f6322472cb3a581f0b4), [`d6d42c2`](https://github.com/dfadler/zombie-mermaid/commit/d6d42c28673f8ee6a8f5c1c93b529fbd60d197d9), [`826d509`](https://github.com/dfadler/zombie-mermaid/commit/826d509a3f3fae2ceb83fa2cb5ec16b92a8cef58), [`3032714`](https://github.com/dfadler/zombie-mermaid/commit/3032714c01a08d44d14fd208d43d163b314a9816), [`89f48a2`](https://github.com/dfadler/zombie-mermaid/commit/89f48a22e7acd99dfcb6c14305a62a90f27b1020), [`9ef496c`](https://github.com/dfadler/zombie-mermaid/commit/9ef496c5abb0db46c18d0ccc8760c7d330feb131), [`469eb95`](https://github.com/dfadler/zombie-mermaid/commit/469eb95712ad2eb9f627f2b8388cf356e3e5d3e7), [`ab3796c`](https://github.com/dfadler/zombie-mermaid/commit/ab3796c4528300addaf278df35cd1fb8b6dbd9d1), [`e4140ee`](https://github.com/dfadler/zombie-mermaid/commit/e4140ee6cca35c408581051be81532c2501a6c7f), [`dce37d7`](https://github.com/dfadler/zombie-mermaid/commit/dce37d7623c4f1a6bbf8db80234f0c82a4bdfc34), [`e7deaa9`](https://github.com/dfadler/zombie-mermaid/commit/e7deaa9a7d389494934a2cb207a2626e3aff7a36), [`b718557`](https://github.com/dfadler/zombie-mermaid/commit/b71855778f5936817fb35189c236d151ff6e760d), [`19060af`](https://github.com/dfadler/zombie-mermaid/commit/19060af7643b8f12602a0e5a86297615a71faf38), [`4b32ef5`](https://github.com/dfadler/zombie-mermaid/commit/4b32ef5899910e064be2bc17e447532e52643ace), [`14c826d`](https://github.com/dfadler/zombie-mermaid/commit/14c826debef1ab01d77343a57be7e880e50f6bee), [`e78a677`](https://github.com/dfadler/zombie-mermaid/commit/e78a677907611e531c474750cf3de72b8d89acc2)]:
  - @zombie-mermaid/svg-renderer@5.15.0
  - @zombie-mermaid/ascii-renderer@5.15.0
  - @zombie-mermaid/core@5.15.0
  - @zombie-mermaid/mcp@5.15.0

## 5.14.4

### Patch Changes

- Updated dependencies [[`bd2e21a`](https://github.com/dfadler/zombie-mermaid/commit/bd2e21a703aa70ba4138a6cfb88588d51fab6b1f), [`1f2cdeb`](https://github.com/dfadler/zombie-mermaid/commit/1f2cdeb0900be425ef5b31b6c39efd5fbb1540c8), [`dc32d5a`](https://github.com/dfadler/zombie-mermaid/commit/dc32d5a03ff36f013a311370adfcdba0ac46c25d), [`dbc2e44`](https://github.com/dfadler/zombie-mermaid/commit/dbc2e44d29f993943abe583a715bac8fee6ee130), [`343bed4`](https://github.com/dfadler/zombie-mermaid/commit/343bed4b1f905c815579faed8f737feb43371c67), [`6742ec1`](https://github.com/dfadler/zombie-mermaid/commit/6742ec12dd4f36901fd7adc729b8394fb05cb6c1), [`05bb530`](https://github.com/dfadler/zombie-mermaid/commit/05bb530b124807e5fa274de686d305be6eb8b56c), [`aa7e1b8`](https://github.com/dfadler/zombie-mermaid/commit/aa7e1b853a3ba4fa0c802f9b009682e89ef89a52), [`4ac10b9`](https://github.com/dfadler/zombie-mermaid/commit/4ac10b9ada5373b6f0d96c117e8430db0e920481), [`4672083`](https://github.com/dfadler/zombie-mermaid/commit/4672083a2429022339634625c54e0fd405bf636f), [`2cd3569`](https://github.com/dfadler/zombie-mermaid/commit/2cd3569debb60dee47df194e65be7de5698dcdc3), [`f77c298`](https://github.com/dfadler/zombie-mermaid/commit/f77c298f9e2bdfcb70558832c91807eb985c5e15), [`d0f6a4e`](https://github.com/dfadler/zombie-mermaid/commit/d0f6a4e9062e14c210ddacc49c2a67786355cbba), [`8fca8fa`](https://github.com/dfadler/zombie-mermaid/commit/8fca8fa456b0b969adf274547158651d276499c0), [`69d756e`](https://github.com/dfadler/zombie-mermaid/commit/69d756edb612693f161e8acd1f3426e597a29401), [`79c80f7`](https://github.com/dfadler/zombie-mermaid/commit/79c80f71efc0817c4143650bb0f0ebd96ae439e7), [`615937d`](https://github.com/dfadler/zombie-mermaid/commit/615937d2218e1ea13f6283564c70c5e2bd8990c1), [`26de325`](https://github.com/dfadler/zombie-mermaid/commit/26de325e318e51f563480a791525294523881b02), [`3a3c7ac`](https://github.com/dfadler/zombie-mermaid/commit/3a3c7ac0f82cd0955e2d6b736b197897da18ade9), [`4513203`](https://github.com/dfadler/zombie-mermaid/commit/451320397bdb7cba734c0dc35676f92c1ec9594b), [`a8a524e`](https://github.com/dfadler/zombie-mermaid/commit/a8a524e15ed347eb551a302c8c0e5daf2c9527f3), [`4366ad7`](https://github.com/dfadler/zombie-mermaid/commit/4366ad71e81cff6ecbfdb320ddf472e257c0556d), [`bcbe70c`](https://github.com/dfadler/zombie-mermaid/commit/bcbe70ce628cd1034b14623da6460744815e567b), [`67fc597`](https://github.com/dfadler/zombie-mermaid/commit/67fc5975db7d19d1dcc57ec90a9e0e38cafe138e), [`95b2272`](https://github.com/dfadler/zombie-mermaid/commit/95b22727a28f627db81efbeafbaca075d0314b05), [`6f2607d`](https://github.com/dfadler/zombie-mermaid/commit/6f2607daf73d2859aa8929268bd1f3520d214435)]:
  - @zombie-mermaid/svg-renderer@5.14.4
  - @zombie-mermaid/core@5.14.4
  - @zombie-mermaid/ascii-renderer@5.14.4
  - @zombie-mermaid/mcp@5.14.4

## 5.14.3

### Patch Changes

- Updated dependencies [[`08ef003`](https://github.com/dfadler/zombie-mermaid/commit/08ef003d73adb15144aa4f8806ede0e0c34f530a), [`427597e`](https://github.com/dfadler/zombie-mermaid/commit/427597e23b42b10d8830c7fa52cded72c825ab3a), [`083ce72`](https://github.com/dfadler/zombie-mermaid/commit/083ce722e9e289b1229942808899fcd2a57b8930), [`1e019fa`](https://github.com/dfadler/zombie-mermaid/commit/1e019fa12439aa207b056d049c7959bba96f9617), [`88fda60`](https://github.com/dfadler/zombie-mermaid/commit/88fda60354f16a5a730d03d3ec9260fbf0ee8c0b), [`3e1e9f8`](https://github.com/dfadler/zombie-mermaid/commit/3e1e9f8e3f65768c7176b677d003700fb77a69ff), [`e00ffd6`](https://github.com/dfadler/zombie-mermaid/commit/e00ffd69c481276c051687ecd6d8eb4fc07bb80c), [`c4137f7`](https://github.com/dfadler/zombie-mermaid/commit/c4137f7db30f404bed796d50b5dfb2dbc4ce108e), [`47ea03c`](https://github.com/dfadler/zombie-mermaid/commit/47ea03c0b092eaac588810931aee417942f74917), [`c75bab5`](https://github.com/dfadler/zombie-mermaid/commit/c75bab509c1d384cf0ee045e26ad5bcc9137a9df), [`8757f5d`](https://github.com/dfadler/zombie-mermaid/commit/8757f5d24cace494346cb15b40f3047114f1d2d1), [`c387226`](https://github.com/dfadler/zombie-mermaid/commit/c38722658c4347f4ea56e8d5694373c6bd0f28ea), [`485fdd4`](https://github.com/dfadler/zombie-mermaid/commit/485fdd40bde3ece362d27ef3290912360efa5462), [`0198234`](https://github.com/dfadler/zombie-mermaid/commit/01982344cd2a31a76f1c6b5e08eb573a1e4e6d70), [`9791be1`](https://github.com/dfadler/zombie-mermaid/commit/9791be181bbfb26dee3a08c80af27ef9d6744d3f), [`ed96f8d`](https://github.com/dfadler/zombie-mermaid/commit/ed96f8d00a43fef1d7d4e0654293b66b1866f02b), [`14e73ec`](https://github.com/dfadler/zombie-mermaid/commit/14e73ecb377660a67acfdb46dfb7bab57b55bff7), [`9d60652`](https://github.com/dfadler/zombie-mermaid/commit/9d60652938ec1342bdbf6cfe0f18e302132c901f)]:
  - @zombie-mermaid/svg-renderer@5.14.3
  - @zombie-mermaid/core@5.14.3
  - @zombie-mermaid/ascii-renderer@5.14.3
  - @zombie-mermaid/mcp@5.14.3

## 5.14.2

### Patch Changes

- Updated dependencies [[`fab7886`](https://github.com/dfadler/zombie-mermaid/commit/fab7886ca83e4c4476fd92eecf8360c9868eb750), [`3671791`](https://github.com/dfadler/zombie-mermaid/commit/3671791ca95b26bc509888baa900daf1f94a7309), [`bb958a3`](https://github.com/dfadler/zombie-mermaid/commit/bb958a3ed81de0abefd4e3fcc8b1e64bd9af27d8), [`d725006`](https://github.com/dfadler/zombie-mermaid/commit/d725006c3c46b58078b9ebe12962730961411aa5), [`35d1f0a`](https://github.com/dfadler/zombie-mermaid/commit/35d1f0a6be0f4c8be8ecafec49882eb5a7dbe199), [`ee1a26d`](https://github.com/dfadler/zombie-mermaid/commit/ee1a26db8994f916e41cc11bb6f5cca0f71d8e8c), [`1941517`](https://github.com/dfadler/zombie-mermaid/commit/1941517fdc686b8700126b4e33f814764b0c3e91), [`df677f5`](https://github.com/dfadler/zombie-mermaid/commit/df677f5e0a63f4885562ca7dad8b5b743881e2ea)]:
  - @zombie-mermaid/svg-renderer@5.14.2
  - @zombie-mermaid/core@5.14.2
  - @zombie-mermaid/ascii-renderer@5.14.2
  - @zombie-mermaid/mcp@5.14.2

## 5.14.1

### Patch Changes

- Updated dependencies [[`13617eb`](https://github.com/dfadler/zombie-mermaid/commit/13617eb067df154e257a7fba42039523b47fb7b8), [`bad44f4`](https://github.com/dfadler/zombie-mermaid/commit/bad44f4e106be390a78a91080c540f289b960d15)]:
  - @zombie-mermaid/ascii-renderer@5.14.1
  - @zombie-mermaid/svg-renderer@5.14.1
  - @zombie-mermaid/mcp@5.14.1
  - @zombie-mermaid/core@5.14.1

## 5.14.0

### Patch Changes

- Updated dependencies [[`b918077`](https://github.com/dfadler/zombie-mermaid/commit/b9180775816e55e81fcea6d6823fa5ec2dcfa856), [`96abf55`](https://github.com/dfadler/zombie-mermaid/commit/96abf5540701843be4397ab34cc3049a4fe82459), [`91bc6cf`](https://github.com/dfadler/zombie-mermaid/commit/91bc6cf917e65fd9b38e89c0ad3a01ceccbd4d51), [`8a8463d`](https://github.com/dfadler/zombie-mermaid/commit/8a8463da1b5de205525258c203b4dc5aadae568a)]:
  - @zombie-mermaid/ascii-renderer@5.14.0
  - @zombie-mermaid/svg-renderer@5.14.0
  - @zombie-mermaid/core@5.14.0
  - @zombie-mermaid/mcp@5.14.0

## 5.13.0

### Patch Changes

- Updated dependencies [[`d3eedd2`](https://github.com/dfadler/zombie-mermaid/commit/d3eedd2feda1347fc82c87a98d5c714e27351fc4), [`817885e`](https://github.com/dfadler/zombie-mermaid/commit/817885ec949b96e5e92835dc7547a4ebc5a22af3), [`5eaccb9`](https://github.com/dfadler/zombie-mermaid/commit/5eaccb94bc869e7ec6715bc50f805b5d0dac6862), [`96cd7e6`](https://github.com/dfadler/zombie-mermaid/commit/96cd7e634fc3543629b032994e2ff347faedb76b)]:
  - @zombie-mermaid/ascii-renderer@5.13.0
  - @zombie-mermaid/svg-renderer@5.13.0
  - @zombie-mermaid/core@5.13.0
  - @zombie-mermaid/mcp@5.13.0

## 5.12.0

### Minor Changes

- [#2399](https://github.com/dfadler/zombie-mermaid/pull/2399) [`6024647`](https://github.com/dfadler/zombie-mermaid/commit/6024647f1d7992459a00aebee5b9ce1d25eb7fe0) Thanks [@dfadler](https://github.com/dfadler)! - CLI: `zombie-mermaid --check <file.md>...` validates every `mermaid` fenced block in Markdown files, printing `file:line: message` for each invalid block and exiting 1 ([#1876](https://github.com/dfadler/zombie-mermaid/issues/1876)).

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@5.12.0
  - @zombie-mermaid/mcp@5.12.0
  - @zombie-mermaid/svg-renderer@5.12.0
  - @zombie-mermaid/core@5.12.0

## 5.11.3

### Patch Changes

- Updated dependencies [[`ca18ea9`](https://github.com/dfadler/zombie-mermaid/commit/ca18ea9bf1f420075443e74221a865aff603beb9), [`5ca6d42`](https://github.com/dfadler/zombie-mermaid/commit/5ca6d42abc5fbeb90bd42d19cdf025798b53f40f)]:
  - @zombie-mermaid/ascii-renderer@5.11.3
  - @zombie-mermaid/core@5.11.3
  - @zombie-mermaid/mcp@5.11.3
  - @zombie-mermaid/svg-renderer@5.11.3

## 5.11.2

### Patch Changes

- Updated dependencies [[`0a0e51c`](https://github.com/dfadler/zombie-mermaid/commit/0a0e51c33cdb4c902b85ec442426638034bda381), [`c5d83df`](https://github.com/dfadler/zombie-mermaid/commit/c5d83dff19a64756398704e28f9d7c449a605faa)]:
  - @zombie-mermaid/ascii-renderer@5.11.2
  - @zombie-mermaid/mcp@5.11.2
  - @zombie-mermaid/core@5.11.2
  - @zombie-mermaid/svg-renderer@5.11.2

## 5.11.1

### Patch Changes

- Updated dependencies [[`3d5e2a3`](https://github.com/dfadler/zombie-mermaid/commit/3d5e2a3232cef4ad8c51d2c609d538511b45efd4)]:
  - @zombie-mermaid/ascii-renderer@5.11.1
  - @zombie-mermaid/mcp@5.11.1
  - @zombie-mermaid/core@5.11.1
  - @zombie-mermaid/svg-renderer@5.11.1

## 5.11.0

### Patch Changes

- Updated dependencies [[`82674ef`](https://github.com/dfadler/zombie-mermaid/commit/82674ef11fa576022f80191dbd1537be229fac4a), [`bc452e7`](https://github.com/dfadler/zombie-mermaid/commit/bc452e762a64afa970a1762d0bb623eb7e008aa4), [`e7ade77`](https://github.com/dfadler/zombie-mermaid/commit/e7ade7773ed06814a74a2123dc1db69c7864880e), [`6b04529`](https://github.com/dfadler/zombie-mermaid/commit/6b04529b795d895a8dc1edd96e33b42b15a42d01), [`b7f6aec`](https://github.com/dfadler/zombie-mermaid/commit/b7f6aeca3921e720e1318bdf04abd895fa4e3d82), [`42f3e40`](https://github.com/dfadler/zombie-mermaid/commit/42f3e40eca7cf0253ee86fcb5ae072807cdc070d), [`ed2ad94`](https://github.com/dfadler/zombie-mermaid/commit/ed2ad9468b465565c93367c054f83381b5f44487)]:
  - @zombie-mermaid/ascii-renderer@5.11.0
  - @zombie-mermaid/mcp@5.11.0
  - @zombie-mermaid/core@5.11.0
  - @zombie-mermaid/svg-renderer@5.11.0

## 5.10.2

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@5.10.2
  - @zombie-mermaid/core@5.10.2
  - @zombie-mermaid/mcp@5.10.2
  - @zombie-mermaid/svg-renderer@5.10.2

## 5.10.1

### Patch Changes

- Updated dependencies [[`0932ec7`](https://github.com/dfadler/zombie-mermaid/commit/0932ec76666fc81574607829b819fd35715b9b9e)]:
  - @zombie-mermaid/ascii-renderer@5.10.1
  - @zombie-mermaid/mcp@5.10.1
  - @zombie-mermaid/core@5.10.1
  - @zombie-mermaid/svg-renderer@5.10.1

## 5.10.0

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@5.10.0
  - @zombie-mermaid/core@5.10.0
  - @zombie-mermaid/mcp@5.10.0
  - @zombie-mermaid/svg-renderer@5.10.0
