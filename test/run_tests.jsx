// 入稿チェック.jsx の回帰テスト
//
// 実行方法（Bashから osascript 経由）:
//   osascript -e 'with timeout of 300 seconds
//     tell application "Adobe Illustrator" to do javascript (read (POSIX file "<このファイルの絶対パス>") as «class utf8»)
//   end timeout'
//
// AppleEventのタイムアウト（既定120秒）に処理時間が引っかかることがあるため、
// 結果は戻り値だけでなく result.txt にも書き出す（タイムアウトしても後から確認できる）。
//
// 既知の問題を仕込んだテストドキュメントを作り、scanDocument() を直接呼んで
// 期待するカウントと一致するか検証する。

// $.fileName は do javascript に文字列として渡した場合は使えない
// （ファイルとして実行されていないため）ので絶対パスを直接指定する
var PROJECT_DIR = "/Users/yamaguchishohei/Library/CloudStorage/Dropbox/app_setting/adobe_illustrator/script/スクリプト/yama/入稿チェック";
var PROD_SCRIPT = new File(PROJECT_DIR + "/入稿チェック.jsx");
var FIXTURES = PROJECT_DIR + "/test/fixtures/";
var RESULT_FILE = new File(PROJECT_DIR + "/test/result.txt");

var report = [];
var pass = 0, fail = 0, errors = [];

function check(label, actual, expected) {
    var ok = actual === expected;
    if (ok) pass++; else fail++;
    report.push((ok ? "PASS" : "FAIL") + "  " + label + "  実際=" + actual + "  期待=" + expected);
}

function checkApprox(label, actual, expected, tolerance) {
    var ok = Math.abs(actual - expected) <= tolerance;
    if (ok) pass++; else fail++;
    report.push((ok ? "PASS" : "FAIL") + "  " + label + "  実際=" + actual + "  期待=" + expected + "±" + tolerance);
}

function checkGte(label, actual, minExpected) {
    var ok = actual >= minExpected;
    if (ok) pass++; else fail++;
    report.push((ok ? "PASS" : "FAIL") + "  " + label + "  実際=" + actual + "  期待>=" + minExpected);
}

function objKeys(obj) {
    var a = [];
    for (var k in obj) { if (obj.hasOwnProperty(k)) a.push(k); }
    return a;
}

function makeStrayPoint(container, x, y, name) {
    var p;
    try {
        p = container.pathItems.add();
        p.setEntirePath([[x, y]]);
    } catch (e) {
        p = container.pathItems.add();
        p.setEntirePath([[x, y], [x + 1, y + 1]]);
        if (p.pathPoints.length > 1) p.pathPoints[1].remove();
    }
    p.filled = false;
    p.stroked = false;
    p.name = name;
    return p;
}

function writeResultFile(text) {
    RESULT_FILE.encoding = "UTF-8";
    RESULT_FILE.open("w");
    RESULT_FILE.write(text);
    RESULT_FILE.close();
}

var doc = null;
var savedUIL = null;

try {
    // ---- 本番スクリプトを関数定義だけ読み込む（main()は自動実行させない） ----
    AUTORUN = false;
    $.evalFile(PROD_SCRIPT);

    // 無人実行の要。CMYKドキュメントにRGBプロファイル付き画像を embed() すると
    // 「埋め込まれたプロファイルの不一致」ダイアログが出て do javascript がブロックする
    // （在席者が手動でOKを押していたため今まで気づかなかった）。
    // DONTDISPLAYALERTS でこの種のモーダルを抑止し、既定動作で進める。
    savedUIL = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    // ---- フィクスチャドキュメントの構築 ----
    doc = app.documents.add(DocumentColorSpace.CMYK, 3000, 3000);
    var layer0 = doc.layers[0];
    layer0.name = "メイン";

    // ラスタライズ効果解像度（150ppiに設定して読み取れるか確認）
    try {
        var reo = new RasterEffectOptions();
        reo.resolution = 150;
        doc.rasterEffectSettings = reo;
    } catch (e) {
        errors.push("rasterEffectSettings設定失敗: " + e.message);
    }

    var black = new CMYKColor();
    black.cyan = 0; black.magenta = 0; black.yellow = 0; black.black = 100;

    // 1) CMYK小数点
    var pDecimal = layer0.pathItems.rectangle(100, 100, 50, 50);
    pDecimal.name = "小数点CMYK";
    pDecimal.filled = true;
    var cDecimal = new CMYKColor();
    cDecimal.cyan = 50.5; cDecimal.magenta = 20; cDecimal.yellow = 0; cDecimal.black = 0;
    pDecimal.fillColor = cDecimal;
    pDecimal.stroked = false;

    // 2) 総インキ量超過（TAC）
    var pTac = layer0.pathItems.rectangle(100, 200, 50, 50);
    pTac.name = "TAC超";
    pTac.filled = true;
    var cTac = new CMYKColor();
    cTac.cyan = 100; cTac.magenta = 100; cTac.yellow = 100; cTac.black = 100;
    pTac.fillColor = cTac;
    pTac.stroked = false;

    // 3) 白のオーバープリント
    var pWhiteOp = layer0.pathItems.rectangle(100, 300, 50, 50);
    pWhiteOp.name = "白ノセ";
    pWhiteOp.filled = true;
    var cWhite = new CMYKColor();
    cWhite.cyan = 0; cWhite.magenta = 0; cWhite.yellow = 0; cWhite.black = 0;
    pWhiteOp.fillColor = cWhite;
    pWhiteOp.fillOverprint = true;
    pWhiteOp.stroked = false;

    // 4) 細い線（0.1mm未満）
    var pThin = layer0.pathItems.rectangle(100, 400, 50, 50);
    pThin.name = "細線";
    pThin.filled = false;
    pThin.stroked = true;
    pThin.strokeColor = black;
    pThin.strokeWidth = 0.1; // pt（閾値は約0.283pt）

    // 5) 孤立点
    var pStray = makeStrayPoint(layer0, 500, 100, "孤立点");

    // 6) 塗り・線なしオブジェクト
    var pNoFill = layer0.pathItems.rectangle(100, 600, 50, 50);
    pNoFill.name = "塗り線なし";
    pNoFill.filled = false;
    pNoFill.stroked = false;

    // 7) ガイド（塗り線なしだがチェック対象外であるべき）
    var pGuide = layer0.pathItems.rectangle(100, 700, 50, 50);
    pGuide.name = "ガイド";
    pGuide.filled = false;
    pGuide.stroked = false;
    pGuide.guides = true;

    // 8) クリッピングマスク（マスクパスは塗り線なしチェックから除外されるべき）
    var maskPath = layer0.pathItems.rectangle(100, 800, 100, 100);
    maskPath.filled = false;
    maskPath.stroked = false;
    maskPath.name = "マスクパス";
    var maskedContent = layer0.pathItems.rectangle(100, 800, 100, 100);
    maskedContent.filled = true;
    maskedContent.fillColor = black;
    maskedContent.name = "マスク対象";
    var clipGroup = layer0.groupItems.add();
    clipGroup.name = "クリップグループ";
    maskPath.move(clipGroup, ElementPlacement.PLACEATBEGINNING);
    maskedContent.move(clipGroup, ElementPlacement.PLACEATEND);
    clipGroup.clipped = true;

    // 9) 空のテキストパス
    var tfEmpty = layer0.textFrames.add();
    tfEmpty.contents = "";
    tfEmpty.name = "空テキスト";
    tfEmpty.top = 900; tfEmpty.left = 100;

    // 10) アウトライン化されていないテキスト
    var tfText = layer0.textFrames.add();
    tfText.contents = "テスト文字列ABC";
    tfText.name = "通常テキスト";
    tfText.top = 950; tfText.left = 100;

    // 11) ロックされたオブジェクト（グループ内、再帰カウントの確認）
    var lockGroup = layer0.groupItems.add();
    lockGroup.name = "ロックを含むグループ";
    var pInsideLocked = lockGroup.pathItems.rectangle(1500, 100, 50, 50);
    pInsideLocked.filled = true;
    pInsideLocked.fillColor = black;
    pInsideLocked.locked = true;

    // 12) 非表示オブジェクト（グループ内、再帰カウントの確認）
    var hideGroup = layer0.groupItems.add();
    hideGroup.name = "非表示を含むグループ";
    var pInsideHidden = hideGroup.pathItems.rectangle(1500, 300, 50, 50);
    pInsideHidden.filled = true;
    pInsideHidden.fillColor = black;
    pInsideHidden.hidden = true;

    // 13) サブレイヤー内の孤立点（サブレイヤー再帰チェックの確認）
    var subLayer = layer0.layers.add();
    subLayer.name = "サブレイヤー";
    var pStraySub = makeStrayPoint(subLayer, 2000, 100, "サブレイヤー孤立点");

    // 14) ロックされたレイヤー（中身は全チェック対象外であるべき）
    var lockedLayer = doc.layers.add();
    lockedLayer.name = "ロックレイヤー";
    var pInLockedLayer = lockedLayer.pathItems.rectangle(2200, 100, 50, 50);
    pInLockedLayer.filled = false;
    pInLockedLayer.stroked = false; // 本来ならnoFill対象だが、レイヤーごとロックなので対象外のはず
    lockedLayer.locked = true;

    // 15) 非表示レイヤー
    var hiddenLayer = doc.layers.add();
    hiddenLayer.name = "非表示レイヤー";
    var pInHiddenLayer = hiddenLayer.pathItems.rectangle(2400, 100, 50, 50);
    pInHiddenLayer.filled = false;
    pInHiddenLayer.stroked = false;
    hiddenLayer.visible = false;

    // PlacedItems.add()はアクティブレイヤーに依存するため、非表示レイヤー作成で
    // ずれたアクティブレイヤーをlayer0に戻す
    doc.activeLayer = layer0;

    // 16) 埋め込み画像：低解像度（72dpiメタデータ→300pt幅で配置＝実効72dpi）
    var placedLow = layer0.placedItems.add();
    placedLow.file = new File(FIXTURES + "dpi_72.jpg");
    placedLow.name = "低解像度画像";
    placedLow.top = 2600; placedLow.left = 100;
    placedLow.embed();

    // 17) 埋め込み画像：高解像度（300dpiメタデータ→72pt幅で配置＝実効300dpi、対照用）
    var placedHigh = layer0.placedItems.add();
    placedHigh.file = new File(FIXTURES + "dpi_300.jpg");
    placedHigh.name = "高解像度画像";
    placedHigh.top = 2600; placedHigh.left = 500;
    placedHigh.embed();

    // 18) リンク画像（RGB、埋め込まない→ヘッダ解析で判定されるはず）
    var linkedRgb = layer0.placedItems.add();
    linkedRgb.file = new File(FIXTURES + "test_rgb.jpg");
    linkedRgb.name = "リンクRGB";
    linkedRgb.top = 2600; linkedRgb.left = 900;

    // 19) リンク画像（CMYK、対照用。RGBとして誤検出されないことを確認）
    var linkedCmyk = layer0.placedItems.add();
    linkedCmyk.file = new File(FIXTURES + "test_cmyk.jpg");
    linkedCmyk.name = "リンクCMYK";
    linkedCmyk.top = 2600; linkedCmyk.left = 1000;

    // 20) リンク切れ（配置後にファイルを削除してリンクを壊す）
    var dummyPath = FIXTURES + "_tmp_broken_link.jpg";
    var srcForDummy = new File(FIXTURES + "test_rgb.jpg");
    srcForDummy.copy(dummyPath);
    var linkedBroken = layer0.placedItems.add();
    linkedBroken.file = new File(dummyPath);
    linkedBroken.name = "リンク切れ予定";
    linkedBroken.top = 2600; linkedBroken.left = 1100;
    new File(dummyPath).remove();

    // ---- スキャン実行 ----
    var results = scanDocument(null);

    // ---- 検証 ----
    check("ドキュメントカラーモード", results.documentColorMode, "CMYK");
    checkApprox("ラスタライズ効果解像度", results.rasterEffectResolution === null ? -1 : results.rasterEffectResolution, 150, 1);
    check("CMYK小数点の色数", objKeys(results.cmykDecimals).length, 1);
    check("総インキ量320%超の色数", objKeys(results.tacColors).length, 1);
    check("白のオーバープリント個数", results.whiteOverprintItems.length, 1);
    check("0.1mm未満の線の個数", results.thinStrokeItems.length, 1);
    check("孤立点の個数（メイン+サブレイヤー）", results.strayPointItems.length, 2);
    // pNoFill + pStray + pStraySub の3つが該当（孤立点は塗り線なしも兼ねる）。ガイド・クリップは除外
    check("塗り線なしオブジェクト個数（孤立点も含む。ガイド・クリップは除外）", results.noFillItems.length, 3);
    check("空のテキストパス個数", results.emptyTextItems.length, 1);
    check("アウトライン化されていないテキスト個数", results.outlineTextItems.length, 1);
    check("ロックされたオブジェクト個数（グループ内含む）", results.lockedCount, 1);
    check("非表示オブジェクト個数（グループ内含む）", results.hiddenCount, 1);
    check("チェック対象外レイヤー数（ロック+非表示）", results.skippedLayers.length, 2);
    check("300dpi未満の画像個数", results.lowResItems.length, 1);
    check("RGB画像の個数（埋め込みはCMYK変換されるためリンクの1件のみ想定）", results.rgbImageItems.length, 1);
    check("自動判定不可リンクの個数", results.unknownLinkLabels.length, 0);
    check("リンク切れ画像の個数", results.brokenLinkItems.length, 1);
    check("オブジェクト数", results.objectCount, 17);
    checkGte("使用色数が1以上", objKeys(results.colors).length, 1);
    checkGte("使用フォント数が1以上", objKeys(results.fonts).length, 1);

} catch (e) {
    errors.push("テスト実行中に例外: " + e.message + (e.line ? "（行:" + e.line + "）" : ""));
} finally {
    if (doc) {
        try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) { }
    }
    if (savedUIL !== null) {
        try { app.userInteractionLevel = savedUIL; } catch (e3) { }
    }
}

var summary = "=== 入稿チェック 回帰テスト結果 ===\n" +
    report.join("\n") +
    "\n----------------------------------------\n" +
    "PASS: " + pass + "  FAIL: " + fail +
    (errors.length ? "\n[エラー]\n" + errors.join("\n") : "");

writeResultFile(summary);
summary;
