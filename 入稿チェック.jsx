// UI設定の定数
var UI_CONSTANTS = {
    NOTE_INDENT: 24,           // 注釈テキストの左インデント
    NOTE_SPACING: 2,           // 注釈グループ内の行間隔
    NOTE_FONT_SIZE: 12,        // 注釈テキストのフォントサイズ
    NOTE_OPACITY: 0.3,         // 注釈テキストの不透明度
    MAIN_FONT_SIZE: 12         // メインテキスト（チェック項目名・結果）のフォントサイズ
};

// チェック基準の定数
var CHECK_CONSTANTS = {
    MIN_STROKE_PT: 0.1 * 72 / 25.4,  // 線幅の下限 0.1mm（約0.283pt）
    MIN_IMAGE_DPI: 300,              // 埋め込み画像の解像度下限
    TAC_LIMIT: 320,                  // 総インキ量（C+M+Y+K）の上限%
    MIN_RASTER_EFFECT_PPI: 300       // ラスタライズ効果解像度の下限
};

var COLOR_GREEN = [0, 0.8, 0, 1];
var COLOR_RED = [1, 0, 0, 1];
var COLOR_GRAY = [0.55, 0.55, 0.55, 1];

// 最後のスキャン結果（「選択」ボタン・再チェック・保存で使う）
var lastResults = null;

// ------------------------------------------------------------
// カラーユーティリティ
// ------------------------------------------------------------

// 色情報を一意のキーに変換する関数
function getColorKey(color) {
    if (color.typename === "SpotColor") {
        return "Spot:" + color.spot.name;
    } else if (color.typename === "GradientColor") {
        var key = "Gradient:";
        for (var i = 0; i < color.gradient.gradientStops.length; i++) {
            var stop = color.gradient.gradientStops[i];
            key += getColorKey(stop.color) + ";";
        }
        return key;
    } else if (color.typename === "RGBColor") {
        return "RGB:" + color.red + "," + color.green + "," + color.blue;
    } else if (color.typename === "CMYKColor") {
        return "CMYK:" + color.cyan + "," + color.magenta + "," + color.yellow + "," + color.black;
    } else if (color.typename === "GrayColor") {
        return "Gray:" + color.gray;
    } else if (color.typename === "NoColor") {
        return "NoColor";
    }
    return "Unknown";
}

// CMYK値に小数点があるかチェックする関数
function hasCMYKDecimal(color) {
    function hasRealDecimal(value) {
        // 小数点以下が0の場合（例：60.00）は小数点ありとみなさない
        var rounded = Math.round(value);
        return Math.abs(value - rounded) > 0.001; // 浮動小数点の誤差を考慮
    }

    if (color.typename === "CMYKColor") {
        return (hasRealDecimal(color.cyan) ||
            hasRealDecimal(color.magenta) ||
            hasRealDecimal(color.yellow) ||
            hasRealDecimal(color.black));
    } else if (color.typename === "SpotColor" && color.spot.color.typename === "CMYKColor") {
        var spotColor = color.spot.color;
        return (hasRealDecimal(spotColor.cyan) ||
            hasRealDecimal(spotColor.magenta) ||
            hasRealDecimal(spotColor.yellow) ||
            hasRealDecimal(spotColor.black));
    } else if (color.typename === "GradientColor") {
        for (var i = 0; i < color.gradient.gradientStops.length; i++) {
            if (hasCMYKDecimal(color.gradient.gradientStops[i].color)) {
                return true;
            }
        }
    }
    return false;
}

// CMYK値を文字列にフォーマットする関数
function formatCMYKValue(color) {
    function formatNumber(num) {
        // 小数点以下が0の場合は整数表示
        if (num % 1 === 0 || num.toFixed(2) === Math.floor(num).toFixed(0)) {
            return Math.floor(num).toString();
        } else {
            // 小数点以下の末尾の0を削除
            return parseFloat(num.toFixed(2)).toString();
        }
    }

    if (color.typename === "CMYKColor") {
        return "C:" + formatNumber(color.cyan) + " M:" + formatNumber(color.magenta) +
            " Y:" + formatNumber(color.yellow) + " K:" + formatNumber(color.black);
    } else if (color.typename === "SpotColor" && color.spot.color.typename === "CMYKColor") {
        var spotColor = color.spot.color;
        return color.spot.name + "（C:" + formatNumber(spotColor.cyan) + " M:" +
            formatNumber(spotColor.magenta) + " Y:" + formatNumber(spotColor.yellow) +
            " K:" + formatNumber(spotColor.black) + "）";
    }
    return "";
}

// 白かどうか判定する関数（白のオーバープリント検出用）
function isWhiteColor(color) {
    if (!color) return false;
    if (color.typename === "CMYKColor") {
        return color.cyan < 0.01 && color.magenta < 0.01 &&
            color.yellow < 0.01 && color.black < 0.01;
    }
    if (color.typename === "RGBColor") {
        return color.red > 254.5 && color.green > 254.5 && color.blue > 254.5;
    }
    if (color.typename === "GrayColor") {
        return color.gray < 0.01;
    }
    return false;
}

// CMYKの総インキ量を返す関数（CMYK系以外は -1）
function getCMYKTotal(color) {
    if (color.typename === "CMYKColor") {
        return color.cyan + color.magenta + color.yellow + color.black;
    }
    if (color.typename === "SpotColor" && color.spot.color.typename === "CMYKColor") {
        var sc = color.spot.color;
        return sc.cyan + sc.magenta + sc.yellow + sc.black;
    }
    return -1;
}

// ------------------------------------------------------------
// リンク画像のカラーモード判定（ファイルヘッダをバイナリで読む。開かないので高速）
// ------------------------------------------------------------

function byteAt(s, i) {
    return s.charCodeAt(i) & 0xFF;
}

// PSD: ヘッダ26バイトのうちオフセット24-25がカラーモード
function sniffPsd(f) {
    var result = "unknown";
    f.encoding = "BINARY";
    if (!f.open("r")) return result;
    try {
        var h = f.read(26);
        if (h.length >= 26 && h.substring(0, 4) === "8BPS") {
            var mode = (byteAt(h, 24) << 8) | byteAt(h, 25);
            if (mode === 3) result = "RGB";
            else if (mode === 4) result = "CMYK";
            else if (mode === 1 || mode === 8) result = "Gray";
        }
    } catch (e) { }
    f.close();
    return result;
}

// TIFF: 最初のIFDからタグ262（PhotometricInterpretation）を読む
function sniffTiff(f) {
    var result = "unknown";
    var little = false;

    function u16(s, i) {
        return little ? (byteAt(s, i) | (byteAt(s, i + 1) << 8))
            : ((byteAt(s, i) << 8) | byteAt(s, i + 1));
    }
    function u32(s, i) {
        return little
            ? (byteAt(s, i) + byteAt(s, i + 1) * 0x100 + byteAt(s, i + 2) * 0x10000 + byteAt(s, i + 3) * 0x1000000)
            : (byteAt(s, i) * 0x1000000 + byteAt(s, i + 1) * 0x10000 + byteAt(s, i + 2) * 0x100 + byteAt(s, i + 3));
    }

    f.encoding = "BINARY";
    if (!f.open("r")) return result;
    try {
        var h = f.read(8);
        if (h.length === 8 && (byteAt(h, 0) === 0x49 || byteAt(h, 0) === 0x4D)) {
            little = (byteAt(h, 0) === 0x49);
            var off = u32(h, 4);
            if (f.seek(off, 0)) {
                var cntS = f.read(2);
                if (cntS.length === 2) {
                    var n = u16(cntS, 0);
                    if (n > 0 && n < 1000) {
                        var entries = f.read(n * 12);
                        for (var i = 0; i + 12 <= entries.length; i += 12) {
                            if (u16(entries, i) === 262) {
                                var val = u16(entries, i + 8);
                                if (val === 2) result = "RGB";
                                else if (val === 5) result = "CMYK";
                                else if (val <= 1) result = "Gray";
                                break;
                            }
                        }
                    }
                }
            }
        }
    } catch (e) { }
    f.close();
    return result;
}

// JPEG: SOFマーカーの成分数（1=Gray, 3=RGB/YCbCr, 4=CMYK/YCCK）
function sniffJpeg(f) {
    var result = "unknown";
    f.encoding = "BINARY";
    if (!f.open("r")) return result;
    try {
        var s = f.read(2);
        if (s.length === 2 && byteAt(s, 0) === 0xFF && byteAt(s, 1) === 0xD8) {
            var guard = 0;
            while (guard++ < 500) {
                var b = f.read(1);
                if (b.length < 1 || byteAt(b, 0) !== 0xFF) break;
                var mb = f.read(1);
                if (mb.length < 1) break;
                var marker = byteAt(mb, 0);
                // FFパディングを読み飛ばす
                var padGuard = 0;
                while (marker === 0xFF && padGuard++ < 100) {
                    mb = f.read(1);
                    if (mb.length < 1) { marker = -1; break; }
                    marker = byteAt(mb, 0);
                }
                if (marker < 0) break;
                // 長さフィールドを持たないマーカー
                if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
                if (marker === 0xD9) break;
                var lenS = f.read(2);
                if (lenS.length < 2) break;
                var len = (byteAt(lenS, 0) << 8) | byteAt(lenS, 1);
                if (len < 2) break;
                // SOF0〜SOF15（DHT/JPG/DACを除く）
                if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    var body = f.read(len - 2);
                    if (body.length >= 6) {
                        var comps = byteAt(body, 5);
                        if (comps === 4) result = "CMYK";
                        else if (comps === 3) result = "RGB";
                        else if (comps === 1) result = "Gray";
                    }
                    break;
                }
                if (marker === 0xDA) break; // 画像データ開始
                f.seek(len - 2, 1);
            }
        }
    } catch (e) { }
    f.close();
    return result;
}

// 拡張子でふりわけて判定。"RGB" / "CMYK" / "Gray" / "unknown" を返す
function sniffFileColorSpace(file) {
    var name = file.name.toLowerCase();
    var dot = name.lastIndexOf(".");
    var ext = (dot >= 0) ? name.substring(dot + 1) : "";
    try {
        if (ext === "psd" || ext === "psb") return sniffPsd(file);
        if (ext === "tif" || ext === "tiff") return sniffTiff(file);
        if (ext === "jpg" || ext === "jpeg") return sniffJpeg(file);
        if (ext === "png" || ext === "gif" || ext === "bmp") return "RGB"; // これらの形式はCMYK非対応
    } catch (e) {
        try { file.close(); } catch (e2) { }
    }
    return "unknown"; // ai / eps / pdf などは自動判定不可
}

// ------------------------------------------------------------
// 汎用ユーティリティ
// ------------------------------------------------------------

function objKeys(obj) {
    var a = [];
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) a.push(k);
    }
    return a;
}

// テキストの内容を短い抜粋にする（改行はスペースに）
function textExcerpt(tf) {
    var c = "";
    try { c = tf.contents + ""; } catch (e) { }
    c = c.replace(/[\r\n]+/g, " ");
    if (c.length > 12) c = c.substring(0, 12) + "…";
    return c;
}

// File名の表示用（displayNameがあれば使う）
function fileDisplayName(f) {
    var n = "";
    try { n = f.displayName; } catch (e) { }
    if (!n) {
        try { n = decodeURI(f.name); } catch (e2) { n = f.name; }
    }
    return n;
}

// ------------------------------------------------------------
// UIヘルパー
// ------------------------------------------------------------

// チェックマーク作成
function createCheckMark(parent, isCheck) {
    var mark = parent.add("statictext", undefined, isCheck ? "✓" : "✗");
    mark.characters = 2;
    mark.graphics.font = ScriptUI.newFont("Arial", "REGULAR", 13);
    var penColor = isCheck ? COLOR_GREEN : COLOR_RED;
    var pen = mark.graphics.newPen(mark.graphics.PenType.SOLID_COLOR, penColor, 1);
    mark.graphics.foregroundColor = pen;
    return mark;
}

// 注釈テキストのスタイル設定を共通化
function applyNoteStyle(textElement) {
    textElement.graphics.foregroundColor = textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, [1, 1, 1, UI_CONSTANTS.NOTE_OPACITY], 1);
}

// メインテキスト（チェック項目名・結果）のスタイル設定を共通化
function applyMainTextStyle(textElement) {
    textElement.graphics.font = ScriptUI.newFont("dialog", "REGULAR", UI_CONSTANTS.MAIN_FONT_SIZE);
}

// 赤・緑・グレーのペンを作成する共通関数
function createColorPens(textElement) {
    return {
        redPen: textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, COLOR_RED, 1),
        greenPen: textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, COLOR_GREEN, 1),
        grayPen: textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, COLOR_GRAY, 1)
    };
}

// 注釈グループを作成する共通関数
function createNoteGroup(parent) {
    var noteGroup = parent.add("group");
    noteGroup.orientation = "column";
    noteGroup.alignChildren = ["left", "top"];
    noteGroup.spacing = UI_CONSTANTS.NOTE_SPACING;
    noteGroup.margins = [UI_CONSTANTS.NOTE_INDENT, 0, 0, 0];
    return noteGroup;
}

// メインモジュールグループを作成する共通関数
function createModuleGroup(parent) {
    var group = parent.add("group");
    group.orientation = "column";
    group.alignChildren = ["left", "top"];
    group.spacing = 4; // 項目タイトルと注釈の間
    return group;
}

// カウントグループ（横並び）を作成する共通関数
function createCountGroup(parent) {
    var countGroup = parent.add("group");
    countGroup.orientation = "row";
    countGroup.alignChildren = ["left", "center"];
    countGroup.spacing = 0; // チェックマークと項目タイトルの間
    return countGroup;
}

// チェック行（マーク＋ラベル＋カウント＋任意で選択ボタン）を作成
function createCheckRow(parent, labelText, selectKey) {
    var rowGroup = createCountGroup(parent);
    var r = { group: rowGroup };
    r.checkMark = createCheckMark(rowGroup, true);
    r.label = rowGroup.add("statictext", undefined, labelText);
    r.countText = rowGroup.add("statictext", undefined, "");
    r.countText.characters = 8;
    applyMainTextStyle(r.label);
    applyMainTextStyle(r.countText);
    var pens = createColorPens(r.countText);
    r.redPen = pens.redPen;
    r.greenPen = pens.greenPen;
    r.grayPen = pens.grayPen;
    if (selectKey) {
        r.selectButton = rowGroup.add("button", undefined, "選択");
        r.selectButton.preferredSize = [48, 22];
        r.selectButton.enabled = false;
        r.selectButton.onClick = function () { selectResultItems(selectKey); };
    }
    return r;
}

// チェック行の表示を更新
function setCheckRow(r, text, isOk) {
    r.countText.text = text;
    r.checkMark.text = isOk ? "✓" : "✗";
    r.checkMark.graphics.foregroundColor = r.checkMark.graphics.newPen(r.checkMark.graphics.PenType.SOLID_COLOR, isOk ? COLOR_GREEN : COLOR_RED, 1);
    r.countText.graphics.foregroundColor = isOk ? r.greenPen : r.redPen;
    if (r.selectButton) r.selectButton.enabled = !isOk;
}

// チェック行を「対象外」表示にする
function setCheckRowNA(r, text) {
    r.checkMark.text = "-";
    r.checkMark.graphics.foregroundColor = r.checkMark.graphics.newPen(r.checkMark.graphics.PenType.SOLID_COLOR, COLOR_GRAY, 1);
    r.countText.text = text || "-";
    r.countText.graphics.foregroundColor = r.grayPen;
    if (r.selectButton) r.selectButton.enabled = false;
}

// 詳細テキスト（注釈スタイル）を作成
function createDetailText(parent) {
    var g = createNoteGroup(parent);
    var t = g.add("statictext", undefined, "");
    t.characters = 45;
    applyNoteStyle(t);
    return t;
}

// 詳細テキストの表示を更新
function setDetail(t, arr) {
    t.text = (arr && arr.length) ? arr.join(", ") : "";
    applyNoteStyle(t);
}

// 区切り線を追加
function addSeparator(parent) {
    var separator = parent.add("panel");
    separator.alignment = "fill";
    separator.height = 1;
    return separator;
}

// 問題オブジェクトを選択する（「選択」ボタンから呼ばれる）
function selectResultItems(key) {
    if (!lastResults || !lastResults[key] || lastResults[key].length === 0) return;
    var items = lastResults[key];
    var okCount = 0;
    try { app.activeDocument.selection = null; } catch (e) { }
    for (var i = 0; i < items.length; i++) {
        try {
            items[i].selected = true;
            okCount++;
        } catch (e) {
            // ロックされたオブジェクト等は選択できないのでスキップ
        }
    }
    try { app.redraw(); } catch (e) { }
    if (okCount < items.length) {
        alert((items.length - okCount) + "個はロック等のため選択できませんでした。");
    }
}

// ------------------------------------------------------------
// 各チェック項目のUIモジュール（表示のみ。スキャンは scanDocument に一本化）
// ------------------------------------------------------------

var checkModules = {

    // ドキュメントカラーモード
    documentColorModeCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "ドキュメントカラーモード：");
            this.row.countText.characters = 12;
            this.detailGroup = createNoteGroup(group);
            this.detailText = this.detailGroup.add("statictext", undefined, "印刷にはCMYKモードを推奨します");
            applyNoteStyle(this.detailText);
        },
        updateUI: function (results) {
            var isCMYK = results.documentColorMode === "CMYK";
            setCheckRow(this.row, results.documentColorMode || "不明", isCMYK);
            this.detailGroup.visible = !isCMYK;
        }
    },

    // CMYK小数点
    cmykDecimalCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "CMYK値に小数点がある色：");
            this.detailText = createDetailText(group);
        },
        updateUI: function (results) {
            if (results.documentColorMode === "RGB") {
                setCheckRowNA(this.row);
                setDetail(this.detailText, ["※ RGBモードでは判定できません"]);
                return;
            }
            var details = objKeys(results.cmykDecimals);
            setCheckRow(this.row, details.length + "色", details.length === 0);
            setDetail(this.detailText, details);
        }
    },

    // 総インキ量（TAC）
    tacCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "総インキ量" + CHECK_CONSTANTS.TAC_LIMIT + "%超の色：");
            this.detailText = createDetailText(group);
            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ C+M+Y+Kの合計。超えるとインキが乾かず裏移りの原因に");
            applyNoteStyle(note1);
        },
        updateUI: function (results) {
            if (results.documentColorMode === "RGB") {
                setCheckRowNA(this.row);
                setDetail(this.detailText, ["※ RGBモードでは判定できません"]);
                return;
            }
            var details = objKeys(results.tacColors);
            var labels = [];
            for (var i = 0; i < details.length; i++) {
                labels.push(results.tacColors[details[i]]);
            }
            setCheckRow(this.row, details.length + "色", details.length === 0);
            setDetail(this.detailText, labels);
        }
    },

    // 白のオーバープリント
    whiteOverprintCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "白のオーバープリント：", "whiteOverprintItems");
            this.detailText = createDetailText(group);
            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ 白にオーバープリントが設定されていると印刷で消えます");
            applyNoteStyle(note1);
        },
        updateUI: function (results) {
            var count = results.whiteOverprintItems.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.whiteOverprintLabels);
        }
    },

    // 線幅
    strokeWidthCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "0.1mm未満の線幅の線：", "thinStrokeItems");
            this.detailText = createDetailText(group);
        },
        updateUI: function (results) {
            var count = results.thinStrokeItems.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.thinStrokeLabels);
        }
    },

    // RGB画像（埋め込み・リンク両方）
    rgbImageCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "RGB画像（埋め込み・リンク）：", "rgbImageItems");
            this.detailText = createDetailText(group);
            var noteGroup = createNoteGroup(group);
            this.unknownText = noteGroup.add("statictext", undefined, "");
            this.unknownText.characters = 45;
            applyNoteStyle(this.unknownText);
        },
        updateUI: function (results) {
            var count = results.rgbImageItems.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.rgbImageLabels);
            if (results.unknownLinkLabels.length > 0) {
                var t = "※ 自動判定不可（要手動確認）: " + results.unknownLinkLabels.join(", ");
                if (t.length > 90) t = t.substring(0, 90) + "…";
                this.unknownText.text = t;
            } else {
                this.unknownText.text = "";
            }
            applyNoteStyle(this.unknownText);
        }
    },

    // リンク切れ
    brokenLinkCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "リンク切れの配置画像：", "brokenLinkItems");
            this.detailText = createDetailText(group);
        },
        updateUI: function (results) {
            var count = results.brokenLinkItems.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.brokenLinkLabels);
        }
    },

    // 埋め込み画像の実効解像度
    imageResolutionCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, CHECK_CONSTANTS.MIN_IMAGE_DPI + "dpi未満の画像（埋め込み）：", "lowResItems");
            this.detailText = createDetailText(group);
            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ 配置スケールを反映した実効解像度で判定。リンク画像は対象外");
            applyNoteStyle(note1);
        },
        updateUI: function (results) {
            var count = results.lowResItems.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.lowResLabels);
        }
    },

    // ラスタライズ効果の解像度
    rasterEffectCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "ラスタライズ効果の解像度：");
            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ 効果 > ドキュメントのラスタライズ効果設定… で変更（推奨" + CHECK_CONSTANTS.MIN_RASTER_EFFECT_PPI + "ppi）");
            applyNoteStyle(note1);
        },
        updateUI: function (results) {
            var res = results.rasterEffectResolution;
            if (res === null) {
                setCheckRowNA(this.row, "取得不可");
                return;
            }
            setCheckRow(this.row, Math.round(res) + "ppi", res >= CHECK_CONSTANTS.MIN_RASTER_EFFECT_PPI - 0.5);
        }
    },

    // チェック対象外レイヤー（ロック・非表示）
    skippedLayerCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "ロック / 非表示のレイヤー：");
            this.detailText = createDetailText(group);
            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ この中のオブジェクトは全チェックの対象外です");
            applyNoteStyle(note1);
        },
        updateUI: function (results) {
            var count = results.skippedLayers.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.skippedLayers);
        }
    },

    // ロック・非表示オブジェクト
    lockHideCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.lockRow = createCheckRow(group, "ロックされているオブジェクト：");
            this.hideRow = createCheckRow(group, "非表示のオブジェクト：");

            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ グループ内のオブジェクトも含む");
            var note2 = noteGroup.add("statictext", undefined, "※ 非表示とは「Command + 3」で隠したオブジェクト");
            applyNoteStyle(note1);
            applyNoteStyle(note2);
        },
        updateUI: function (results) {
            setCheckRow(this.lockRow, results.lockedCount + "個", results.lockedCount === 0);
            setCheckRow(this.hideRow, results.hiddenCount + "個", results.hiddenCount === 0);
        }
    },

    // アウトライン化されていないテキスト
    outlineTextCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.row = createCheckRow(group, "アウトライン化されていないテキスト：", "outlineTextItems");
            this.detailText = createDetailText(group);
        },
        updateUI: function (results) {
            var count = results.outlineTextItems.length;
            setCheckRow(this.row, count + "個", count === 0);
            setDetail(this.detailText, results.outlineTextLabels);
        }
    },

    // 不要なオブジェクト
    unnecessaryObjectCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.strayRow = createCheckRow(group, "孤立点：", "strayPointItems");
            this.noFillRow = createCheckRow(group, "塗り・線のないオブジェクト：", "noFillItems");
            this.emptyTextRow = createCheckRow(group, "空のテキストパス：", "emptyTextItems");

            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "オブジェクト > パス > パスの削除… で削除できます");
            var note2 = noteGroup.add("statictext", undefined, "※ ガイドとクリッピングマスクは除外");
            applyNoteStyle(note1);
            applyNoteStyle(note2);
        },
        updateUI: function (results) {
            setCheckRow(this.strayRow, results.strayPointItems.length + "個", results.strayPointItems.length === 0);
            setCheckRow(this.noFillRow, results.noFillItems.length + "個", results.noFillItems.length === 0);
            setCheckRow(this.emptyTextRow, results.emptyTextItems.length + "個", results.emptyTextItems.length === 0);
        }
    },

    // 使用フォント一覧
    fontListCheck: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            var countGroup = createCountGroup(group);
            this.label = countGroup.add("statictext", undefined, "使用フォント：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 8;
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            var noteGroup = createNoteGroup(group);
            this.listText = noteGroup.add("statictext", undefined, "", { multiline: true });
            this.listText.preferredSize = [340, 60];
            applyNoteStyle(this.listText);
        },
        updateUI: function (results) {
            var fonts = objKeys(results.fonts);
            fonts.sort();
            this.countText.text = fonts.length + "種";
            var text = fonts.join("、");
            if (text.length > 160) text = text.substring(0, 160) + "…";
            this.listText.text = text;
            applyNoteStyle(this.listText);
        }
    },

    // 使用色数
    colorCount: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            var countGroup = createCountGroup(group);
            this.label = countGroup.add("statictext", undefined, "ファイル内で使用している色数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 8;
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ 塗り・線・文字の色をカウント");
            var note2 = noteGroup.add("statictext", undefined, "※ グラデーションは構成色を個別にカウント");
            var note3 = noteGroup.add("statictext", undefined, "※ 白・黒もカウント");
            applyNoteStyle(note1);
            applyNoteStyle(note2);
            applyNoteStyle(note3);
        },
        updateUI: function (results) {
            this.countText.text = objKeys(results.colors).length + "色";
        }
    },

    // オブジェクト数
    objectCount: {
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            var countGroup = createCountGroup(group);
            this.label = countGroup.add("statictext", undefined, "ファイル内のオブジェクト数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 8;
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            var noteGroup = createNoteGroup(group);
            var note1 = noteGroup.add("statictext", undefined, "※ グループは1つのオブジェクトとしてカウント");
            var note2 = noteGroup.add("statictext", undefined, "※ ロック・非表示・ガイドは除外");
            applyNoteStyle(note1);
            applyNoteStyle(note2);
        },
        updateUI: function (results) {
            this.countText.text = results.objectCount + "個";
        }
    }
};

// 2列レイアウトの並び順
var moduleColumns = [
    [
        "documentColorModeCheck",
        "cmykDecimalCheck",
        "tacCheck",
        "whiteOverprintCheck",
        "strokeWidthCheck",
        "rgbImageCheck",
        "brokenLinkCheck",
        "imageResolutionCheck",
        "rasterEffectCheck"
    ],
    [
        "skippedLayerCheck",
        "lockHideCheck",
        "outlineTextCheck",
        "unnecessaryObjectCheck",
        "fontListCheck",
        "colorCount",
        "objectCount"
    ]
];

// ------------------------------------------------------------
// ドキュメントスキャン（すべてのチェックをここで一括実行）
// ------------------------------------------------------------

function scanDocument(progress) {
    var doc = app.activeDocument;
    var results = {
        documentColorMode: "",
        rasterEffectResolution: null,
        skippedLayers: [],
        lockedCount: 0,
        hiddenCount: 0,
        objectCount: 0,
        colors: {},
        cmykDecimals: {},
        tacColors: {},
        fonts: {},
        strayPointItems: [],
        noFillItems: [],
        emptyTextItems: [],
        thinStrokeLabels: [],
        thinStrokeItems: [],
        outlineTextLabels: [],
        outlineTextItems: [],
        lowResLabels: [],
        lowResItems: [],
        rgbImageLabels: [],
        rgbImageItems: [],
        unknownLinkLabels: [],
        brokenLinkLabels: [],
        brokenLinkItems: [],
        whiteOverprintLabels: [],
        whiteOverprintItems: []
    };

    // ドキュメントカラーモード
    switch (doc.documentColorSpace) {
        case DocumentColorSpace.CMYK:
            results.documentColorMode = "CMYK";
            break;
        case DocumentColorSpace.RGB:
            results.documentColorMode = "RGB";
            break;
        case DocumentColorSpace.GRAY:
            results.documentColorMode = "グレースケール";
            break;
        default:
            results.documentColorMode = "その他";
            break;
    }

    // ラスタライズ効果解像度
    try {
        results.rasterEffectResolution = doc.rasterEffectSettings.resolution;
    } catch (e) {
        results.rasterEffectResolution = null;
    }

    // 進捗（レイヤー数を再帰で数え、リンク画像数を足す）
    function countLayersRec(layers) {
        var n = layers.length;
        for (var i = 0; i < layers.length; i++) {
            n += countLayersRec(layers[i].layers);
        }
        return n;
    }
    var totalSteps = countLayersRec(doc.layers) + doc.placedItems.length;
    if (totalSteps < 1) totalSteps = 1;
    var currentStep = 0;

    function step() {
        currentStep++;
        if (progress && progress.progressBar) {
            var v = (currentStep / totalSteps) * 100;
            progress.progressBar.value = v > 100 ? 100 : v;
            try { progress.update(); } catch (e) { }
        }
    }

    // 色を記録（使用色・CMYK小数点・総インキ量）
    function checkColor(color) {
        if (!color) return;
        if (color.typename === "GradientColor") {
            // グラデーションは構成色を個別にカウント
            for (var i = 0; i < color.gradient.gradientStops.length; i++) {
                checkColor(color.gradient.gradientStops[i].color);
            }
            return;
        }
        var key = getColorKey(color);
        results.colors[key] = true;
        if (hasCMYKDecimal(color)) {
            results.cmykDecimals[formatCMYKValue(color)] = true;
        }
        var total = getCMYKTotal(color);
        if (total > CHECK_CONSTANTS.TAC_LIMIT + 0.001) {
            results.tacColors[key] = formatCMYKValue(color) + "（計" + Math.round(total) + "%）";
        }
    }

    // PathItemの各種チェック（コンパウンドパス内のパスにも使う）
    function processPathChecks(item) {
        // 孤立点
        if (item.pathPoints.length === 1) {
            results.strayPointItems.push(item);
        }
        // 塗り・線なし（ガイド・クリッピングマスクは除外）
        if (!item.filled && !item.stroked && !item.clipping && !item.guides) {
            results.noFillItems.push(item);
        }
        var isWhiteOP = false;
        if (item.filled) {
            checkColor(item.fillColor);
            try {
                if (item.fillOverprint && isWhiteColor(item.fillColor)) isWhiteOP = true;
            } catch (e) { }
        }
        if (item.stroked) {
            checkColor(item.strokeColor);
            try {
                if (item.strokeOverprint && isWhiteColor(item.strokeColor)) isWhiteOP = true;
            } catch (e) { }
            // 線幅チェック
            if (item.strokeWidth < CHECK_CONSTANTS.MIN_STROKE_PT) {
                var strokeWidth = Math.round(item.strokeWidth * 100) / 100;
                var itemName = item.name || "無名のオブジェクト";
                results.thinStrokeLabels.push(itemName + "（" + strokeWidth + "pt）");
                results.thinStrokeItems.push(item);
            }
        }
        if (isWhiteOP) {
            results.whiteOverprintLabels.push(item.name || "無名のオブジェクト");
            results.whiteOverprintItems.push(item);
        }
    }

    // テキストフレームのチェック
    function processTextFrame(item) {
        var charCount = 0;
        try {
            var tr = item.textRange;
            charCount = (tr && tr.characters) ? tr.characters.length : 0;
        } catch (e) { }

        var contents = "";
        try { contents = item.contents + ""; } catch (e) { }
        var visibleChars = contents.replace(/[\s　]+/g, "");

        // 空（または空白のみ）のテキストパス
        if (charCount === 0 || visibleChars === "") {
            results.emptyTextItems.push(item);
            return;
        }

        // アウトライン化されていないテキスト
        results.outlineTextItems.push(item);
        results.outlineTextLabels.push("「" + textExcerpt(item) + "」");

        // 文字ごとのフォント・色・オーバープリント
        var frameHasWhiteOP = false;
        var tr2 = item.textRange;
        for (var ci = 0; ci < charCount; ci++) {
            try {
                var ch = tr2.characters[ci];
                if (!ch) continue;
                var font = ch.textFont;
                if (font) {
                    results.fonts[font.name] = true;
                }
                if (ch.fillColor) {
                    checkColor(ch.fillColor);
                    try {
                        if (ch.characterAttributes.overprintFill && isWhiteColor(ch.fillColor)) {
                            frameHasWhiteOP = true;
                        }
                    } catch (e2) { }
                }
            } catch (e) {
                // 属性が取得できない文字はスキップ
            }
        }
        if (frameHasWhiteOP) {
            results.whiteOverprintLabels.push("テキスト「" + textExcerpt(item) + "」");
            results.whiteOverprintItems.push(item);
        }
    }

    // 埋め込み画像のチェック（実効解像度・RGB判定）
    function processRaster(item) {
        var imageName = item.name || "埋め込み画像";
        // 実効解像度：埋め込み画像は72ppi基準なので 72 ÷ 配置スケール
        try {
            var m = item.matrix;
            var sx = Math.sqrt(m.mValueA * m.mValueA + m.mValueB * m.mValueB);
            var sy = Math.sqrt(m.mValueC * m.mValueC + m.mValueD * m.mValueD);
            var scale = (sx > sy) ? sx : sy; // 拡大が大きい方＝解像度が低い方で判定
            if (scale > 0) {
                var dpi = 72 / scale;
                if (dpi < CHECK_CONSTANTS.MIN_IMAGE_DPI - 0.5) {
                    results.lowResLabels.push(imageName + "（約" + Math.round(dpi) + "dpi）");
                    results.lowResItems.push(item);
                }
            }
        } catch (e) { }
        // カラーモード判定
        try {
            if (item.imageColorSpace === ImageColorSpace.RGB) {
                results.rgbImageLabels.push(imageName + "（埋め込み）");
                results.rgbImageItems.push(item);
            }
        } catch (e) { }
    }

    // オブジェクトを処理（countAsObject=trueのときオブジェクト数にカウント）
    function processItem(item, countAsObject) {
        if (item.locked) {
            results.lockedCount++;
            return; // ロックされたアイテムは以降のチェックをスキップ
        }
        if (item.hidden) {
            results.hiddenCount++;
            return; // 非表示アイテムは以降のチェックをスキップ
        }

        var tn = item.typename;

        // ガイドは全チェック対象外
        if (tn === "PathItem" && item.guides) return;

        if (countAsObject) results.objectCount++;

        if (tn === "GroupItem") {
            // グループは1つのオブジェクトとしてカウント。中身は再帰チェックのみ
            for (var i = 0; i < item.pageItems.length; i++) {
                processItem(item.pageItems[i], false);
            }
        } else if (tn === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) {
                processPathChecks(item.pathItems[j]);
            }
        } else if (tn === "PathItem") {
            processPathChecks(item);
        } else if (tn === "TextFrame") {
            processTextFrame(item);
        } else if (tn === "RasterItem") {
            processRaster(item);
        }
        // PlacedItem（リンク画像）は doc.placedItems の一括ループで処理
    }

    // レイヤーを再帰処理（サブレイヤーも対象）
    function processLayer(layer) {
        if (layer.locked || !layer.visible) {
            results.skippedLayers.push(layer.name);
            step();
            return;
        }
        for (var j = 0; j < layer.pageItems.length; j++) {
            processItem(layer.pageItems[j], true);
        }
        for (var k = 0; k < layer.layers.length; k++) {
            processLayer(layer.layers[k]);
        }
        step();
    }

    for (var i = 0; i < doc.layers.length; i++) {
        processLayer(doc.layers[i]);
    }

    // リンク画像のチェック（リンク切れ・RGB判定）
    // ※ ファイルを開かずヘッダだけ読むので高速。ロックレイヤー上のリンクも対象
    for (var p = 0; p < doc.placedItems.length; p++) {
        var placed = doc.placedItems[p];
        var linkFile = null;
        try { linkFile = placed.file; } catch (e) { linkFile = null; }

        if (!linkFile || !linkFile.exists) {
            var nm = "";
            try { nm = placed.name; } catch (e) { }
            results.brokenLinkLabels.push(nm || "（名称不明のリンク）");
            results.brokenLinkItems.push(placed);
        } else {
            var space = sniffFileColorSpace(linkFile);
            var dispName = fileDisplayName(linkFile);
            if (space === "RGB") {
                results.rgbImageLabels.push(dispName);
                results.rgbImageItems.push(placed);
            } else if (space === "unknown") {
                results.unknownLinkLabels.push(dispName);
            }
        }
        step();
    }

    return results;
}

// スキャンを実行して結果を保持する
function runScan(progress) {
    var results = scanDocument(progress);
    lastResults = results;
    return results;
}

// 全モジュールの表示を更新
function updateAllModules(results) {
    for (var c = 0; c < moduleColumns.length; c++) {
        for (var i = 0; i < moduleColumns[c].length; i++) {
            var key = moduleColumns[c][i];
            try {
                checkModules[key].updateUI(results);
            } catch (e) {
                alert("表示更新でエラーが発生しました（" + key + "）: " + e.message);
            }
        }
    }
}

// ------------------------------------------------------------
// チェック結果のテキストレポート
// ------------------------------------------------------------

function buildReportText(results, doc) {
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    var d = new Date();
    var when = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
        " " + pad(d.getHours()) + ":" + pad(d.getMinutes());

    var L = [];
    function line(ok, label, value, details) {
        var t = (ok ? "[OK] " : "[NG] ") + label + " " + value;
        L.push(t);
        if (details && details.length) {
            for (var i = 0; i < details.length; i++) {
                L.push("      - " + details[i]);
            }
        }
    }

    L.push("入稿チェック結果");
    L.push("ファイル: " + doc.name);
    L.push("日時: " + when);
    L.push("----------------------------------------");

    line(results.documentColorMode === "CMYK", "ドキュメントカラーモード:", results.documentColorMode);

    if (results.documentColorMode !== "RGB") {
        var dec = objKeys(results.cmykDecimals);
        line(dec.length === 0, "CMYK値に小数点がある色:", dec.length + "色", dec);

        var tacKeys = objKeys(results.tacColors);
        var tacLabels = [];
        for (var t = 0; t < tacKeys.length; t++) tacLabels.push(results.tacColors[tacKeys[t]]);
        line(tacKeys.length === 0, "総インキ量" + CHECK_CONSTANTS.TAC_LIMIT + "%超の色:", tacKeys.length + "色", tacLabels);
    }

    line(results.whiteOverprintItems.length === 0, "白のオーバープリント:", results.whiteOverprintItems.length + "個", results.whiteOverprintLabels);
    line(results.thinStrokeItems.length === 0, "0.1mm未満の線幅の線:", results.thinStrokeItems.length + "個", results.thinStrokeLabels);
    line(results.rgbImageItems.length === 0, "RGB画像（埋め込み・リンク）:", results.rgbImageItems.length + "個", results.rgbImageLabels);
    if (results.unknownLinkLabels.length > 0) {
        L.push("      ※ カラーモード自動判定不可（要手動確認）:");
        for (var u = 0; u < results.unknownLinkLabels.length; u++) {
            L.push("      - " + results.unknownLinkLabels[u]);
        }
    }
    line(results.brokenLinkItems.length === 0, "リンク切れの配置画像:", results.brokenLinkItems.length + "個", results.brokenLinkLabels);
    line(results.lowResItems.length === 0, CHECK_CONSTANTS.MIN_IMAGE_DPI + "dpi未満の画像（埋め込み）:", results.lowResItems.length + "個", results.lowResLabels);

    if (results.rasterEffectResolution !== null) {
        line(results.rasterEffectResolution >= CHECK_CONSTANTS.MIN_RASTER_EFFECT_PPI - 0.5,
            "ラスタライズ効果の解像度:", Math.round(results.rasterEffectResolution) + "ppi");
    }

    line(results.skippedLayers.length === 0, "ロック/非表示のレイヤー（チェック対象外）:", results.skippedLayers.length + "個", results.skippedLayers);
    line(results.lockedCount === 0, "ロックされているオブジェクト:", results.lockedCount + "個");
    line(results.hiddenCount === 0, "非表示のオブジェクト:", results.hiddenCount + "個");
    line(results.outlineTextItems.length === 0, "アウトライン化されていないテキスト:", results.outlineTextItems.length + "個", results.outlineTextLabels);
    line(results.strayPointItems.length === 0, "孤立点:", results.strayPointItems.length + "個");
    line(results.noFillItems.length === 0, "塗り・線のないオブジェクト:", results.noFillItems.length + "個");
    line(results.emptyTextItems.length === 0, "空のテキストパス:", results.emptyTextItems.length + "個");

    L.push("----------------------------------------");
    L.push("オブジェクト数: " + results.objectCount + "個");
    L.push("使用色数: " + objKeys(results.colors).length + "色");

    var fonts = objKeys(results.fonts);
    fonts.sort();
    L.push("使用フォント（" + fonts.length + "種）:");
    for (var fi = 0; fi < fonts.length; fi++) {
        L.push("      - " + fonts[fi]);
    }

    return L.join("\n");
}

// チェック結果をテキストファイルに保存
function saveReport() {
    if (!lastResults) {
        alert("チェック結果がありません。");
        return;
    }
    var doc = app.activeDocument;
    var text = buildReportText(lastResults, doc);

    var defaultName = doc.name.replace(/\.[^.]+$/, "") + "_入稿チェック.txt";
    var target = null;
    try {
        if (doc.path) {
            target = new File(doc.path.fsName + "/" + defaultName);
        }
    } catch (e) {
        target = null; // 未保存ドキュメントは doc.path が取得できない
    }
    if (!target) {
        target = File.saveDialog("チェック結果の保存先を選択（" + defaultName + "）");
        if (!target) return;
    } else if (target.exists) {
        if (!confirm("既に同名のファイルがあります。上書きしますか？\n" + target.fsName)) {
            target = File.saveDialog("チェック結果の保存先を選択（" + defaultName + "）");
            if (!target) return;
        }
    }

    target.encoding = "UTF-8";
    target.lineFeed = "Unix";
    if (target.open("w")) {
        target.write("\uFEFF" + text); // BOM付きUTF-8（他アプリでの文字化け防止）
        target.close();
        alert("保存しました:\n" + target.fsName);
    } else {
        alert("ファイルの保存に失敗しました。");
    }
}

// ------------------------------------------------------------
// メインダイアログ
// ------------------------------------------------------------

function createDialog() {
    var dialog = new Window("dialog", "入稿チェックパネル");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];

    var columnsGroup = dialog.add("group");
    columnsGroup.orientation = "row";
    columnsGroup.alignChildren = ["left", "top"];
    columnsGroup.spacing = 28;
    columnsGroup.margins = 16;

    for (var c = 0; c < moduleColumns.length; c++) {
        var colGroup = columnsGroup.add("group");
        colGroup.orientation = "column";
        colGroup.alignChildren = ["left", "top"];
        colGroup.spacing = 8; // 罫線の上下スペース

        var names = moduleColumns[c];
        for (var i = 0; i < names.length; i++) {
            checkModules[names[i]].createUI(colGroup);
            if (i < names.length - 1) addSeparator(colGroup);
        }

        // 右列の最後に「その他の確認項目」を追加
        if (c === moduleColumns.length - 1) {
            addSeparator(colGroup);

            var otherCheckGroup = colGroup.add("group");
            otherCheckGroup.orientation = "column";
            otherCheckGroup.alignChildren = ["left", "top"];
            otherCheckGroup.spacing = 4;
            otherCheckGroup.margins = [0, 8, 0, 8];

            var otherCheckTitle = otherCheckGroup.add("statictext", undefined, "その他の確認項目");
            otherCheckTitle.graphics.font = ScriptUI.newFont("dialog", "BOLD", UI_CONSTANTS.MAIN_FONT_SIZE);

            var checkItem1 = otherCheckGroup.add("statictext", undefined, "・確認塗りたしはつけられているか");
            checkItem1.graphics.font = ScriptUI.newFont("dialog", "REGULAR", UI_CONSTANTS.MAIN_FONT_SIZE);

            var checkItem2 = otherCheckGroup.add("statictext", undefined, "・オーバープリントプレビューで確認したか(⌘ + option + Shift + Y)");
            checkItem2.graphics.font = ScriptUI.newFont("dialog", "REGULAR", UI_CONSTANTS.MAIN_FONT_SIZE);
        }
    }

    // 選択ボタンの使い方ヒント
    var hint = dialog.add("statictext", undefined, "※「選択」を押してからパネルを閉じると、該当オブジェクトが選択された状態になります");
    hint.alignment = "center";
    applyNoteStyle(hint);

    // ボタン
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignChildren = ["center", "center"];
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;
    buttonGroup.margins = [0, 4, 0, 12];

    var recheckButton = buttonGroup.add("button", undefined, "再チェック");
    recheckButton.onClick = function () {
        try {
            var results = runScan(null);
            updateAllModules(results);
            dialog.layout.layout(true);
        } catch (e) {
            alert("再チェック中にエラーが発生しました: " + e.message);
        }
    };

    var saveButton = buttonGroup.add("button", undefined, "結果を保存");
    saveButton.onClick = function () {
        try {
            saveReport();
        } catch (e) {
            alert("保存中にエラーが発生しました: " + e.message);
        }
    };

    var closeButton = buttonGroup.add("button", undefined, "閉じる");
    closeButton.onClick = function () { dialog.close(); };

    return dialog;
}

// ------------------------------------------------------------
// メイン処理
// ------------------------------------------------------------

function main() {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    var dialog = createDialog();

    // プログレスバーを表示
    var progress = new Window("palette", "チェック中...");
    progress.progressBar = progress.add("progressbar", undefined, 0, 100);
    progress.progressBar.preferredSize.width = 300;

    // プログレスバーをIllustratorのドキュメントウィンドウの中央に配置
    if (app.activeDocument && app.activeDocument.windowBounds) {
        var docBounds = app.activeDocument.windowBounds; // [left, top, right, bottom]
        progress.location = [
            docBounds[0] + (docBounds[2] - docBounds[0] - progress.size.width) / 2,
            docBounds[1] + (docBounds[3] - docBounds[1] - progress.size.height) / 2
        ];
    } else {
        progress.center();
    }
    progress.show();

    try {
        var results = runScan(progress);
        progress.progressBar.value = 100;
        updateAllModules(results);
    } catch (e) {
        alert("エラーが発生しました: " + e.message + (e.line ? "（行: " + e.line + "）" : ""));
    } finally {
        progress.close();
    }

    // ダイアログをIllustratorのドキュメントウィンドウの中央に配置
    if (app.activeDocument && app.activeDocument.windowBounds) {
        var docBounds2 = app.activeDocument.windowBounds;
        dialog.location = [
            docBounds2[0] + (docBounds2[2] - docBounds2[0] - dialog.size.width) / 2,
            docBounds2[1] + (docBounds2[3] - docBounds2[1] - dialog.size.height) / 2
        ];
    } else {
        dialog.center();
    }

    dialog.show();
}

// テストハーネスが $.evalFile() でこのファイルを読み込む際は
// 事前に AUTORUN=false をグローバルに定義することで main() の自動実行を止める
// （関数・定数定義だけを取り込んで scanDocument() 等を直接呼べるようにするため）
if (typeof AUTORUN === "undefined" || AUTORUN) {
    main();
}
