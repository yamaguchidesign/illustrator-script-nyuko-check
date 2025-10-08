// UI設定の定数
var UI_CONSTANTS = {
    NOTE_INDENT: 24,           // 注釈テキストの左インデント
    NOTE_SPACING: 2,           // 注釈グループ内の行間隔
    NOTE_FONT_SIZE: 12,         // 注釈テキストのフォントサイズ
    NOTE_OPACITY: 0.3,         // 注釈テキストの不透明度
    MAIN_FONT_SIZE: 12         // メインテキスト（チェック項目名・結果）のフォントサイズ
};

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

// 共通のチェックマーク作成関数を修正
function createCheckMark(parent, isCheck) {
    var mark = parent.add("statictext", undefined, isCheck ? "✓" : "✗");
    mark.characters = 2;
    mark.margins = [0, 0, 2, 0];
    mark.graphics.font = ScriptUI.newFont("Arial", "REGULAR", 13);
    var penColor = isCheck ? [0, 0.8, 0, 1] : [1, 0, 0, 1]; // 緑または赤
    var pen = mark.graphics.newPen(mark.graphics.PenType.SOLID_COLOR, penColor, 1);
    mark.graphics.foregroundColor = pen;
    return mark;
}

// 注釈テキストのスタイル設定を共通化
function applyNoteStyle(textElement) {
    // フォント設定を削除してデフォルトのままにする
    // textElement.graphics.font = ScriptUI.newFont("Helvetica", "BOLD", 25);
    textElement.graphics.foregroundColor = textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, [1, 1, 1, UI_CONSTANTS.NOTE_OPACITY], 1);
}

// メインテキスト（チェック項目名・結果）のスタイル設定を共通化
function applyMainTextStyle(textElement) {
    textElement.graphics.font = ScriptUI.newFont("dialog", "REGULAR", UI_CONSTANTS.MAIN_FONT_SIZE);
}

// 赤色と緑色のペンを作成する共通関数
function createColorPens(textElement) {
    var redPen = textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
    var greenPen = textElement.graphics.newPen(textElement.graphics.PenType.SOLID_COLOR, [0, 0.8, 0, 1], 1);
    return {
        redPen: redPen,
        greenPen: greenPen
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
    group.spacing = 4;//項目タイトルと注釈の間
    return group;
}

// カウントグループ（横並び）を作成する共通関数
function createCountGroup(parent) {
    var countGroup = parent.add("group");
    countGroup.orientation = "row";
    countGroup.alignChildren = ["left", "center"];
    countGroup.spacing = 0;//チェックマークと項目タイトルの間
    return countGroup;
}

// 各チェック機能のモジュール
var checkModules = {
    // ドキュメントカラーモードチェック機能
    documentColorModeCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);
            this.group = group; // groupを保存

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.checkMark = createCheckMark(countGroup, true);
            this.label = countGroup.add("statictext", undefined, "ドキュメントカラーモード：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 15;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 詳細表示用のグループ
            this.detailGroup = createNoteGroup(group);

            this.detailText = this.detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            applyNoteStyle(this.detailText);
        },

        // ドキュメントカラーモードをチェックする処理
        checkDocumentColorMode: function () {
            var doc = app.activeDocument;
            var colorSpace = doc.documentColorSpace;

            var mode = "";
            var isCMYK = false;

            switch (colorSpace) {
                case DocumentColorSpace.CMYK:
                    mode = "CMYK";
                    isCMYK = true;
                    break;
                case DocumentColorSpace.RGB:
                    mode = "RGB";
                    isCMYK = false;
                    break;
                case DocumentColorSpace.GRAY:
                    mode = "グレースケール";
                    isCMYK = false;
                    break;
                default:
                    mode = "その他";
                    isCMYK = false;
                    break;
            }

            return {
                mode: mode,
                isCMYK: isCMYK
            };
        },

        updateUI: function (results) {
            var isCMYK = results.documentColorMode === "CMYK";
            this.countText.text = results.documentColorMode || "不明";
            this.checkMark.text = isCMYK ? "✓" : "✗";
            var penColor = isCMYK ? [0, 0.8, 0, 1] : [1, 0, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);

            if (isCMYK) {
                this.countText.graphics.foregroundColor = this.greenPen;
                this.detailText.text = "";
                this.detailGroup.visible = false;
            } else {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = "印刷にはCMYKモードを推奨します";
                applyNoteStyle(this.detailText); // スタイルを再適用
                this.detailGroup.visible = true;
            }
        }
    },

    // アートボードの小数点チェック機能
    artboardDecimal: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var headerGroup = group.add("group");
            headerGroup.orientation = "row";
            headerGroup.alignChildren = ["left", "top"];
            headerGroup.spacing = 0;  // チェックマークとタイトルと値の間隔

            // チェックマーク用のテキスト
            this.checkMark = createCheckMark(headerGroup, true);
            this.label = headerGroup.add("statictext", undefined, "位置，サイズに小数点のあるアートボード(px)：");
            this.resultText = headerGroup.add("statictext", undefined, "");
            this.resultText.characters = 5;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.resultText);

            // 各種ペンを作成
            this.redPen = this.resultText.graphics.newPen(this.resultText.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            this.greenPen = this.resultText.graphics.newPen(this.resultText.graphics.PenType.SOLID_COLOR, [0, 0.8, 0, 1], 1);

            // 詳細表示（注釈スタイル）
            var detailGroup = createNoteGroup(group);

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 35;
            applyNoteStyle(this.detailText);
        },

        updateUI: function (results) {
            var hasDecimals = results.artboardDecimals.length > 0;
            this.checkMark.text = hasDecimals ? "✗" : "✓";
            var penColor = hasDecimals ? [1, 0, 0, 1] : [0, 0.8, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);

            this.resultText.text = results.artboardDecimals.length + "個";
            this.resultText.graphics.foregroundColor = hasDecimals ? this.redPen : this.greenPen;
            this.detailText.text = hasDecimals ? "アートボード番号：" + results.artboardDecimals.join(", ") : "";
        }
    },

    // オブジェクト数チェック機能
    objectCount: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.label = countGroup.add("statictext", undefined, "ファイル内のオブジェクト数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 注釈
            var noteGroup = createNoteGroup(group);

            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ グループは1つのオブジェクトとしてカウント");
            var note2 = noteGroup.add("statictext", undefined, "※ ロックされたレイヤーとオブジェクトは除外");

            applyNoteStyle(note1);
            applyNoteStyle(note2);
        },

        // オブジェクトカウント処理
        countObjects: function () {
            var totalCount = 0;

            function traverseItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];
                    if (!item.locked) {
                        totalCount++;
                    }
                }
            }

            for (var i = 0; i < app.activeDocument.layers.length; i++) {
                var layer = app.activeDocument.layers[i];
                if (!layer.locked) {
                    traverseItems(layer);
                }
            }

            return totalCount;
        },

        updateUI: function (results) {
            this.countText.text = results.objectCount + "個";
        }
    },

    // 使用色チェック機能
    colorCount: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.label = countGroup.add("statictext", undefined, "ファイル内で使用している色数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 注釈
            var noteGroup = createNoteGroup(group);

            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ 塗り・線の色をカウント");
            var note2 = noteGroup.add("statictext", undefined, "※ グラデーションは構成色を個別にカウント");
            var note3 = noteGroup.add("statictext", undefined, "※ 白・黒もカウント");

            applyNoteStyle(note1);
            applyNoteStyle(note2);
            applyNoteStyle(note3);
        },

        // 色をカウントする処理
        countColors: function () {
            var doc = app.activeDocument;
            var colorSet = {};

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

            function checkItemColors(item) {
                // テキストフレームの場合は文字カラーをチェック
                if (item.typename === "TextFrame") {
                    var textRange = item.textRange;
                    for (var i = 0; i < textRange.length; i++) {
                        var charColor = textRange.characters[i].fillColor;
                        var charKey = getColorKey(charColor);
                        colorSet[charKey] = true;
                    }
                }

                // 塗りの色をチェック
                if (item.filled) {
                    var fillColor = item.fillColor;
                    var fillKey = getColorKey(fillColor);
                    colorSet[fillKey] = true;
                }

                // 線の色をチェック
                if (item.stroked) {
                    var strokeColor = item.strokeColor;
                    var strokeKey = getColorKey(strokeColor);
                    colorSet[strokeKey] = true;
                }

                // コンパウンドパスの場合は内部のパスもチェック
                if (item.typename === "CompoundPathItem") {
                    for (var i = 0; i < item.pathItems.length; i++) {
                        checkItemColors(item.pathItems[i]);
                    }
                }

                // グループ内のアイテムをチェック
                if (item.typename === "GroupItem") {
                    for (var i = 0; i < item.pageItems.length; i++) {
                        checkItemColors(item.pageItems[i]);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    for (var j = 0; j < layer.pageItems.length; j++) {
                        checkItemColors(layer.pageItems[j]);
                    }
                }
            }

            // colorSetのキーの数をカウント
            var count = 0;
            for (var key in colorSet) {
                count++;
            }
            return count;
        },

        updateUI: function (results) {
            var count = 0;
            for (var key in results.colors) {
                if (results.colors.hasOwnProperty(key)) {
                    count++;
                }
            }
            this.countText.text = count + "色";
        }
    },

    // CMYK小数点チェック機能
    cmykDecimalCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.checkMark = createCheckMark(countGroup, true);
            this.label = countGroup.add("statictext", undefined, "CMYK値に小数点がある色：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 詳細表示用のグループ
            var detailGroup = createNoteGroup(group);

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;

            // RGBモード時のメッセージ
            this.rgbMessage = detailGroup.add("statictext", undefined, "※ RGBモードでは使用できません");
            applyNoteStyle(this.rgbMessage);
            this.rgbMessage.visible = false;

            // カラーモードをチェックして初期状態を設定
            if (app.activeDocument && app.activeDocument.documentColorSpace === DocumentColorSpace.RGB) {
                this.checkMark.visible = false;
                this.countText.text = "-";
                this.detailText.text = "";
                this.rgbMessage.visible = true;
            }
        },

        // CMYK小数点をチェックする処理
        countCMYKDecimals: function () {
            var doc = app.activeDocument;
            var colorSet = {};
            var colorDetails = [];

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

            function hasCMYKDecimal(color) {
                if (color.typename === "CMYKColor") {
                    return (color.cyan % 1 !== 0 ||
                        color.magenta % 1 !== 0 ||
                        color.yellow % 1 !== 0 ||
                        color.black % 1 !== 0);
                } else if (color.typename === "SpotColor" && color.spot.color.typename === "CMYKColor") {
                    var spotColor = color.spot.color;
                    return (spotColor.cyan % 1 !== 0 ||
                        spotColor.magenta % 1 !== 0 ||
                        spotColor.yellow % 1 !== 0 ||
                        spotColor.black % 1 !== 0);
                } else if (color.typename === "GradientColor") {
                    for (var i = 0; i < color.gradient.gradientStops.length; i++) {
                        if (hasCMYKDecimal(color.gradient.gradientStops[i].color)) {
                            return true;
                        }
                    }
                }
                return false;
            }

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
                } else if (color.typename === "CMYKColor") {
                    return "CMYK:" + color.cyan + "," + color.magenta + "," + color.yellow + "," + color.black;
                }
                return color.typename;
            }

            function checkItemColors(item) {
                // テキストフレームの場合は文字カラーをチェック
                if (item.typename === "TextFrame") {
                    var textRange = item.textRange;
                    for (var i = 0; i < textRange.length; i++) {
                        var charColor = textRange.characters[i].fillColor;
                        if (hasCMYKDecimal(charColor)) {
                            var charKey = getColorKey(charColor);
                            if (!colorSet[charKey]) {
                                colorSet[charKey] = true;
                                colorDetails.push(formatCMYKValue(charColor));
                            }
                        }
                    }
                }

                // 塗りの色をチェック
                if (item.filled) {
                    var fillColor = item.fillColor;
                    if (hasCMYKDecimal(fillColor)) {
                        var fillKey = getColorKey(fillColor);
                        if (!colorSet[fillKey]) {
                            colorSet[fillKey] = true;
                            colorDetails.push(formatCMYKValue(fillColor));
                        }
                    }
                }

                // 線の色をチェック
                if (item.stroked) {
                    var strokeColor = item.strokeColor;
                    if (hasCMYKDecimal(strokeColor)) {
                        var strokeKey = getColorKey(strokeColor);
                        if (!colorSet[strokeKey]) {
                            colorSet[strokeKey] = true;
                            colorDetails.push(formatCMYKValue(strokeColor));
                        }
                    }
                }

                // コンパウンドパスの場合は内部のパスもチェック
                if (item.typename === "CompoundPathItem") {
                    for (var i = 0; i < item.pathItems.length; i++) {
                        checkItemColors(item.pathItems[i]);
                    }
                }

                // グループ内のアイテムをチェック
                if (item.typename === "GroupItem") {
                    for (var i = 0; i < item.pageItems.length; i++) {
                        checkItemColors(item.pageItems[i]);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    checkItemColors(layer.pageItems[0]);
                }
            }

            // colorSetのキーの数をカウント
            var count = 0;
            for (var key in colorSet) {
                count++;
            }
            return {
                count: count,
                details: colorDetails
            };
        },

        updateUI: function (results) {
            // ドキュメントのカラーモードをチェック
            if (app.activeDocument.documentColorSpace === DocumentColorSpace.RGB) {
                this.checkMark.visible = false;
                this.countText.text = "-";
                this.detailText.text = "";
                this.rgbMessage.visible = true;
                return;
            }

            this.rgbMessage.visible = false;
            var count = 0;
            var details = [];
            for (var key in results.cmykDecimals) {
                if (results.cmykDecimals.hasOwnProperty(key)) {
                    count++;
                    details.push(key);
                }
            }
            this.countText.text = count + "色";
            this.checkMark.text = count === 0 ? "✓" : "✗";
            var penColor = count === 0 ? [0, 0.8, 0, 1] : [1, 0, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);
            if (count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = details.join(", ");
            } else {
                this.countText.graphics.foregroundColor = this.greenPen;
                this.detailText.text = "";
            }
        }
    },

    // ロック・非表示オブジェクトチェック機能
    lockHideCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // ロックオブジェクト
            var lockGroup = createCountGroup(group);

            this.checkMark = createCheckMark(lockGroup, true);
            this.label = lockGroup.add("statictext", undefined, "ロックされているオブジェクト：");
            this.countText = lockGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);
            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 非表示オブジェクト
            var hideGroup = createCountGroup(group);

            this.hideCheckMark = createCheckMark(hideGroup, true);
            this.hideLabel = hideGroup.add("statictext", undefined, "非表示のオブジェクト：");
            this.hideText = hideGroup.add("statictext", undefined, "");
            this.hideText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.hideLabel);
            applyMainTextStyle(this.hideText);

            // 注釈
            var noteGroup = createNoteGroup(group);

            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ レイヤーごとのロック・非表示は除外");
            var note2 = noteGroup.add("statictext", undefined, "※ 非表示とは「Command + 3」で隠したオブジェクト");

            applyNoteStyle(note1);
            applyNoteStyle(note2);
        },

        // ロック・非表示オブジェクトをカウントする処理
        countLockHideObjects: function () {
            var doc = app.activeDocument;
            var lockedCount = 0;
            var hiddenCount = 0;

            function checkItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];

                    // ロックされているオブジェクトをカウント
                    if (item.locked) {
                        lockedCount++;
                    }

                    // 非表示のオブジェクトをカウント（Command + 3で非表示にしたもの）
                    if (item.hidden) {
                        hiddenCount++;
                    }

                    // グループ内のアイテムをチェック
                    if (item.typename === "GroupItem") {
                        checkItems(item);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    checkItems(layer);
                }
            }

            return {
                locked: lockedCount,
                hidden: hiddenCount
            };
        },

        updateUI: function (results) {
            this.countText.text = results.lockedCount + "個";
            this.hideText.text = results.hiddenCount + "個";

            if (results.lockedCount > 0) {
                this.checkMark.text = "✗";
                this.countText.graphics.foregroundColor = this.redPen;
            } else {
                this.checkMark.text = "✓";
                this.countText.graphics.foregroundColor = this.greenPen;
            }

            if (results.hiddenCount > 0) {
                this.hideCheckMark.text = "✗";
                this.hideText.graphics.foregroundColor = this.redPen;
            } else {
                this.hideCheckMark.text = "✓";
                this.hideText.graphics.foregroundColor = this.greenPen;
            }
        }
    },


    // アウトライン化されていないテキストチェック機能
    outlineTextCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.checkMark = createCheckMark(countGroup, true);
            this.label = countGroup.add("statictext", undefined, "アウトライン化されていないテキスト：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 詳細表示用のグループ
            var detailGroup = createNoteGroup(group);

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            applyNoteStyle(this.detailText);
        },

        // アウトライン化されていないテキストをチェックする処理
        checkOutlineText: function () {
            var doc = app.activeDocument;
            var textItems = [];

            function checkTextItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];

                    if (item.typename === "TextFrame") {
                        // テキストフレームの場合、文字がアウトライン化されているかチェック
                        if (item.textRange.length > 0) {
                            // テキストが存在する場合、アウトライン化されていないとみなす
                            textItems.push(item);
                        }
                    }

                    // グループの場合は再帰的にチェック
                    if (item.typename === "GroupItem") {
                        checkTextItems(item);
                    }
                }
            }

            // ロックされていないレイヤーのみをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    checkTextItems(layer);
                }
            }

            var details = [];
            for (var i = 0; i < textItems.length; i++) {
                details.push("テキスト" + (i + 1));
            }

            return {
                count: textItems.length,
                details: details
            };
        },

        updateUI: function (results) {
            var count = results.outlineText ? results.outlineText.length : 0;
            this.countText.text = count + "個";
            this.checkMark.text = count === 0 ? "✓" : "✗";
            var penColor = count === 0 ? [0, 0.8, 0, 1] : [1, 0, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);

            if (count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = results.outlineText ? results.outlineText.join(", ") : "";
            } else {
                this.countText.graphics.foregroundColor = this.greenPen;
                this.detailText.text = "";
            }
        }
    },

    // 不要なオブジェクトチェック機能
    unnecessaryObjectCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // 孤立点
            var strayGroup = createCountGroup(group);

            this.strayCheckMark = createCheckMark(strayGroup, true);
            this.strayLabel = strayGroup.add("statictext", undefined, "孤立点：");
            this.strayText = strayGroup.add("statictext", undefined, "");
            this.strayText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.strayLabel);
            applyMainTextStyle(this.strayText);

            // 塗りなしオブジェクト
            var noFillGroup = createCountGroup(group);

            this.noFillCheckMark = createCheckMark(noFillGroup, true);
            this.noFillLabel = noFillGroup.add("statictext", undefined, "塗りのないオブジェクト：");
            this.noFillText = noFillGroup.add("statictext", undefined, "");
            this.noFillText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.noFillLabel);
            applyMainTextStyle(this.noFillText);

            // 空テキストパス
            var emptyTextGroup = createCountGroup(group);

            this.emptyTextCheckMark = createCheckMark(emptyTextGroup, true);
            this.emptyTextLabel = emptyTextGroup.add("statictext", undefined, "空のテキストパス：");
            this.emptyTextText = emptyTextGroup.add("statictext", undefined, "");
            this.emptyTextText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.emptyTextLabel);
            applyMainTextStyle(this.emptyTextText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.strayText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 注釈テキスト
            var noteGroup = createNoteGroup(group);
            noteGroup.margins = [UI_CONSTANTS.NOTE_INDENT, 10, 0, 0];

            var noteText = noteGroup.add("statictext", undefined, "オブジェクト>パス>パスの削除... で削除");
            applyNoteStyle(noteText);
        },

        // 不要なオブジェクトをカウントする処理
        countUnnecessaryObjects: function () {
            var doc = app.activeDocument;
            var strayPoints = 0;
            var noFill = 0;
            var emptyText = 0;
            var debugMessages = []; // デバッグメッセージを保存

            function checkItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];

                    // 孤立点のチェック
                    if (item.typename === "PathItem" && item.pathPoints.length === 1) {
                        strayPoints++;
                    }

                    // 塗りなしオブジェクトのチェック（クリッピングマスクのマスクは除外）
                    if (item.typename === "PathItem" && !item.filled && !item.stroked) {
                        // デバッグ: clippingプロパティの値を確認
                        var debugInfo = "オブジェクト: " + (item.name || "無名");
                        debugInfo += " | clipping: " + item.clipping;
                        debugInfo += " | guides: " + item.guides;
                        if (item.parent && item.parent.typename === "GroupItem") {
                            debugInfo += " | 親clipped: " + item.parent.clipped;
                        }
                        debugMessages.push(debugInfo);

                        // clippingプロパティがtrueの場合はクリッピングマスクのマスクなので除外
                        if (!item.clipping) {
                            noFill++;
                        }
                    }

                    // 空テキストパスのチェック
                    if (item.typename === "TextFrame" && item.textRange.length === 0) {
                        emptyText++;
                    }

                    // グループ内のアイテムをチェック
                    if (item.typename === "GroupItem") {
                        checkItems(item);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    checkItems(layer);
                }
            }

            // デバッグ情報を表示（最初の5件のみ）
            if (debugMessages.length > 0) {
                var displayCount = debugMessages.length < 5 ? debugMessages.length : 5;
                var debugOutput = "塗りなしオブジェクトのデバッグ情報（最初の" + displayCount + "件）:\n\n";
                for (var d = 0; d < displayCount; d++) {
                    debugOutput += (d + 1) + ". " + debugMessages[d] + "\n";
                }
                debugOutput += "\n合計: " + debugMessages.length + "個";
                alert(debugOutput);
            }

            return {
                strayPoints: strayPoints,
                noFill: noFill,
                emptyText: emptyText
            };
        },

        updateUI: function (results) {
            this.strayText.text = results.strayPoints + "個";
            this.noFillText.text = results.noFillCount + "個";
            this.emptyTextText.text = results.emptyTextCount + "個";

            this.strayCheckMark.text = results.strayPoints === 0 ? "✓" : "✗";
            this.noFillCheckMark.text = results.noFillCount === 0 ? "✓" : "✗";
            this.emptyTextCheckMark.text = results.emptyTextCount === 0 ? "✓" : "✗";

            if (results.strayPoints > 0) {
                this.strayText.graphics.foregroundColor = this.redPen;
            } else {
                this.strayText.graphics.foregroundColor = this.greenPen;
            }

            if (results.noFillCount > 0) {
                this.noFillText.graphics.foregroundColor = this.redPen;
            } else {
                this.noFillText.graphics.foregroundColor = this.greenPen;
            }

            if (results.emptyTextCount > 0) {
                this.emptyTextText.graphics.foregroundColor = this.redPen;
            } else {
                this.emptyTextText.graphics.foregroundColor = this.greenPen;
            }

        }
    },

    // 線幅チェック機能
    strokeWidthCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.checkMark = createCheckMark(countGroup, true);
            this.label = countGroup.add("statictext", undefined, "0.1mmより小さい線幅の線：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 詳細表示用のグループ
            var detailGroup = createNoteGroup(group);

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            applyNoteStyle(this.detailText);
        },

        // 線幅をチェックする処理
        checkStrokeWidth: function () {
            var doc = app.activeDocument;
            var thinStrokes = [];
            var minWidthPt = 0.28; // 0.1mm = 約0.28pt

            function checkItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];

                    // 線幅チェック
                    if (item.stroked && item.strokeWidth < minWidthPt) {
                        var strokeWidth = Math.round(item.strokeWidth * 100) / 100; // 小数点第2位まで
                        var itemName = item.name || "無名のオブジェクト";
                        thinStrokes.push(itemName + "（" + strokeWidth + "pt）");
                    }

                    // グループ内のアイテムをチェック
                    if (item.typename === "GroupItem") {
                        checkItems(item);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    checkItems(layer);
                }
            }

            return {
                count: thinStrokes.length,
                details: thinStrokes
            };
        },

        updateUI: function (results) {
            var count = results.thinStrokes ? results.thinStrokes.length : 0;
            this.countText.text = count + "個";
            this.checkMark.text = count === 0 ? "✓" : "✗";
            var penColor = count === 0 ? [0, 0.8, 0, 1] : [1, 0, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);

            if (count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = results.thinStrokes.join(", ");
            } else {
                this.countText.graphics.foregroundColor = this.greenPen;
                this.detailText.text = "";
            }
        }
    },

    // RGBリンク画像チェック機能
    rgbLinkedImageCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.checkMark = createCheckMark(countGroup, true);
            this.label = countGroup.add("statictext", undefined, "RGBリンク画像：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 詳細表示用のグループ
            var detailGroup = createNoteGroup(group);

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            applyNoteStyle(this.detailText);
        },

        // RGBリンク画像をチェックする処理
        checkLinkedRGBImages: function () {
            var doc = app.activeDocument;
            var rgbImages = [];

            try {
                // すべてのリンクされた画像をチェック
                for (var i = 0; i < doc.placedItems.length; i++) {
                    var placedItem = doc.placedItems[i];

                    if (placedItem.file && placedItem.file.exists) {
                        try {
                            // ファイルを開いてカラーモードを確認
                            var tempDoc = app.open(placedItem.file);
                            var colorSpace = tempDoc.documentColorSpace;
                            tempDoc.close(SaveOptions.DONOTSAVECHANGES);

                            if (colorSpace === DocumentColorSpace.RGB) {
                                var fileName = placedItem.file.name;
                                rgbImages.push(fileName);
                            }
                        } catch (e) {
                            // ファイルを開けない場合はスキップ
                            $.writeln("RGB画像チェックエラー: " + e.message);
                        }
                    }
                }
            } catch (e) {
                $.writeln("RGBリンク画像チェックエラー: " + e.message);
            }

            return {
                count: rgbImages.length,
                details: rgbImages
            };
        },

        updateUI: function (results) {
            var count = results.rgbLinkedImages ? results.rgbLinkedImages.length : 0;
            this.countText.text = count + "個";
            this.checkMark.text = count === 0 ? "✓" : "✗";
            var penColor = count === 0 ? [0, 0.8, 0, 1] : [1, 0, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);

            if (count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = results.rgbLinkedImages.join(", ");
            } else {
                this.countText.graphics.foregroundColor = this.greenPen;
                this.detailText.text = "";
            }
        }
    },

    // 画像解像度チェック機能
    imageResolutionCheck: {
        // UI要素
        createUI: function (parent) {
            var group = createModuleGroup(parent);

            // メインラベルとカウント
            var countGroup = createCountGroup(group);

            this.checkMark = createCheckMark(countGroup, true);
            this.label = countGroup.add("statictext", undefined, "300dpi以下の埋め込み画像：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // メインテキストのスタイルを適用
            applyMainTextStyle(this.label);
            applyMainTextStyle(this.countText);

            // 赤色と緑色のペンを作成
            var pens = createColorPens(this.countText);
            this.redPen = pens.redPen;
            this.greenPen = pens.greenPen;

            // 詳細表示用のグループ
            var detailGroup = createNoteGroup(group);

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            applyNoteStyle(this.detailText);
        },

        // 画像解像度をチェックする処理
        checkImageResolution: function () {
            var doc = app.activeDocument;
            var lowResImages = [];

            function checkItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];

                    // 埋め込み画像のチェック
                    if (item.typename === "RasterItem") {
                        try {
                            if (item.resolution < 300) {
                                var imageName = item.name || "無名の画像";
                                var resolution = Math.round(item.resolution * 10) / 10; // 小数点第1位まで
                                lowResImages.push(imageName + "（" + resolution + "dpi）");
                            }
                        } catch (e) {
                            // 解像度取得エラーの場合はスキップ
                            $.writeln("画像解像度取得エラー: " + e.message);
                        }
                    }

                    // グループ内のアイテムをチェック
                    if (item.typename === "GroupItem") {
                        checkItems(item);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    checkItems(layer);
                }
            }

            return {
                count: lowResImages.length,
                details: lowResImages
            };
        },

        updateUI: function (results) {
            var count = results.lowResImages ? results.lowResImages.length : 0;
            this.countText.text = count + "個";
            this.checkMark.text = count === 0 ? "✓" : "✗";
            var penColor = count === 0 ? [0, 0.8, 0, 1] : [1, 0, 0, 1];
            this.checkMark.graphics.foregroundColor = this.checkMark.graphics.newPen(this.checkMark.graphics.PenType.SOLID_COLOR, penColor, 1);

            if (count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = results.lowResImages.join(", ");
            } else {
                this.countText.graphics.foregroundColor = this.greenPen;
                this.detailText.text = "";
            }
        }
    }
};

var moduleOrder = [
    "documentColorModeCheck",
    "artboardDecimal",
    "cmykDecimalCheck",
    "strokeWidthCheck",
    "rgbLinkedImageCheck",
    "lockHideCheck",
    "outlineTextCheck",
    "imageResolutionCheck",
    "unnecessaryObjectCheck",
    "colorCount",
    "objectCount"
];

// メインダイアログの作成
function createDialog() {
    var dialog = new Window("dialog", "入稿チェックパネル");
    dialog.preferredSize.width = 300;
    dialog.preferredSize.height = 200;

    var mainGroup = dialog.add("group");
    mainGroup.orientation = "column";
    mainGroup.alignChildren = ["left", "top"];
    mainGroup.spacing = 8;//罫線の上下スペース
    mainGroup.margins = 16;

    // 各モジュールのUI作成
    for (var i = 0; i < moduleOrder.length; i++) {
        var key = moduleOrder[i];
        checkModules[key].createUI(mainGroup);

        // モジュールの間に区切り線を追加
        if (i < moduleOrder.length - 1) { // 最後のモジュールの後には追加しない
            var separator = mainGroup.add("panel");
            separator.alignment = "fill";
            separator.height = 1;
        }
    }

    // ボタン
    var buttonGroup = mainGroup.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignChildren = ["center", "center"];
    buttonGroup.spacing = 10;
    buttonGroup.margins = [0, 10, 0, 0]; // 上部に余白を追加

    var closeButton = buttonGroup.add("button", undefined, "閉じる");

    closeButton.onClick = function () { dialog.close(); }

    return dialog;
}

// ドキュメントスキャン用の共通関数
function scanDocument(progress) {
    var doc = app.activeDocument;
    var results = {
        colors: {},          // Setの代わりにオブジェクトを使用
        cmykDecimals: {},    // Setの代わりにオブジェクトを使用
        fonts: {},           // Setの代わりにオブジェクトを使用
        objectCount: 0,
        lockedCount: 0,
        hiddenCount: 0,
        strayPoints: 0,
        noFillCount: 0,
        emptyTextCount: 0,
        artboardDecimals: [],
        lowResImages: [],    // 300dpi以下の画像リスト
        thinStrokes: [],     // 0.1mm以下の線幅の線リスト
        rgbLinkedImages: [], // RGBリンク画像リスト
        outlineText: [],     // アウトライン化されていないテキストリスト
        documentColorMode: "" // ドキュメントカラーモード
    };

    // ドキュメントカラーモードチェック
    var colorSpace = doc.documentColorSpace;
    switch (colorSpace) {
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

    // 進捗状況を計算するための総ステップ数
    var totalSteps = doc.artboards.length + doc.layers.length;
    var currentStep = 0;

    // プログレスバーの更新関数
    function updateProgress() {
        if (progress && progress.progressBar) {
            progress.progressBar.value = (currentStep / totalSteps) * 100;
        }
    }

    // アートボードのチェック
    for (var i = 0; i < doc.artboards.length; i++) {
        var artboard = doc.artboards[i];
        var rect = artboard.artboardRect;

        for (var j = 0; j < rect.length; j++) {
            if (rect[j] % 1 !== 0) {
                results.artboardDecimals.push(i + 1);
                break;
            }
        }
        currentStep++;
        updateProgress();
    }

    function processItem(item) {
        // オブジェクトのベースチェック
        if (item.locked) {
            results.lockedCount++;
            return; // ロックされたアイテムは以降のチェックをスキップ
        }
        if (item.hidden) {
            results.hiddenCount++;
            return; // 非表示アイテムは以降のチェックをスキップ
        }

        // グループの場合は、グループ自体を1つのオブジェクトとしてカウント
        if (item.typename === "GroupItem") {
            results.objectCount++; // グループを1つとカウント
            for (var i = 0; i < item.pageItems.length; i++) {
                // グループ内のアイテムはカウントせずに、他のチェックのみ実行
                processItemWithoutCount(item.pageItems[i]);
            }
        } else {
            // グループ以外のアイテムは通常通りカウント
            results.objectCount++;
        }

        // 各種チェック
        if (item.typename === "PathItem") {
            // 孤立点チェック
            if (item.pathPoints.length === 1) {
                results.strayPoints++;
            }
            // 塗りなしチェック
            if (!item.filled && !item.stroked) {
                results.noFillCount++;
            }
        }

        // テキストチェック
        if (item.typename === "TextFrame") {
            if (item.textRange.length === 0) {
                results.emptyTextCount++;
            } else {
                // フォントチェック
                var textRange = item.textRange;
                for (var i = 0; i < textRange.length; i++) {
                    var font = textRange.characters[i].textFont;
                    if (font) {
                        results.fonts[font.name] = true;
                    }
                    // 文字色チェック
                    checkColor(textRange.characters[i].fillColor);
                }
            }
        }

        // 色チェック
        if (item.filled) {
            checkColor(item.fillColor);
        }
        if (item.stroked) {
            checkColor(item.strokeColor);
            // 線幅チェック
            var minWidthPt = 0.28; // 0.1mm = 約0.28pt
            if (item.strokeWidth < minWidthPt) {
                var strokeWidth = Math.round(item.strokeWidth * 100) / 100; // 小数点第2位まで
                var itemName = item.name || "無名のオブジェクト";
                results.thinStrokes.push(itemName + "（" + strokeWidth + "pt）");
            }
        }

        // 画像解像度チェック
        if (item.typename === "RasterItem") {
            try {
                if (item.resolution < 300) {
                    var imageName = item.name || "無名の画像";
                    var resolution = Math.round(item.resolution * 10) / 10; // 小数点第1位まで
                    results.lowResImages.push(imageName + "（" + resolution + "dpi）");
                }
            } catch (e) {
                // 解像度取得エラーの場合はスキップ
                $.writeln("画像解像度取得エラー: " + e.message);
            }
        }

        currentStep++;
        updateProgress();
    }

    function processItemWithoutCount(item) {
        if (item.locked || item.hidden) {
            return;
        }

        // 各種チェック
        if (item.typename === "PathItem") {
            // 孤立点チェック
            if (item.pathPoints.length === 1) {
                results.strayPoints++;
            }
            // 塗りなしチェック
            if (!item.filled && !item.stroked) {
                results.noFillCount++;
            }
        }

        // テキストチェック
        if (item.typename === "TextFrame") {
            if (item.textRange.length === 0) {
                results.emptyTextCount++;
            } else {
                // フォントチェック
                var textRange = item.textRange;
                for (var i = 0; i < textRange.length; i++) {
                    var font = textRange.characters[i].textFont;
                    if (font) {
                        results.fonts[font.name] = true;
                    }
                    // 文字色チェック
                    checkColor(textRange.characters[i].fillColor);
                }
            }
        }

        // 色チェック
        if (item.filled) {
            checkColor(item.fillColor);
        }
        if (item.stroked) {
            checkColor(item.strokeColor);
            // 線幅チェック
            var minWidthPt = 0.28; // 0.1mm = 約0.28pt
            if (item.strokeWidth < minWidthPt) {
                var strokeWidth = Math.round(item.strokeWidth * 100) / 100; // 小数点第2位まで
                var itemName = item.name || "無名のオブジェクト";
                results.thinStrokes.push(itemName + "（" + strokeWidth + "pt）");
            }
        }

        // 画像解像度チェック
        if (item.typename === "RasterItem") {
            try {
                if (item.resolution < 300) {
                    var imageName = item.name || "無名の画像";
                    var resolution = Math.round(item.resolution * 10) / 10; // 小数点第1位まで
                    results.lowResImages.push(imageName + "（" + resolution + "dpi）");
                }
            } catch (e) {
                // 解像度取得エラーの場合はスキップ
                $.writeln("画像解像度取得エラー: " + e.message);
            }
        }

        // グループ内のアイテムを処理
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                processItemWithoutCount(item.pageItems[i]);
            }
        }
    }

    function checkColor(color) {
        var colorKey = getColorKey(color);
        if (colorKey) {
            results.colors[colorKey] = true;

            // CMYK小数点チェック
            if (hasCMYKDecimal(color)) {
                results.cmykDecimals[formatCMYKValue(color)] = true;
            }
        }
    }

    // RGBリンク画像チェック
    try {
        // 元のアクティブドキュメントを保存
        var originalDoc = app.activeDocument;

        for (var i = 0; i < doc.placedItems.length; i++) {
            var placedItem = doc.placedItems[i];

            if (placedItem.file && placedItem.file.exists) {
                try {
                    // ファイルを開いてカラーモードを確認
                    var tempDoc = app.open(placedItem.file);
                    var colorSpace = tempDoc.documentColorSpace;
                    tempDoc.close(SaveOptions.DONOTSAVECHANGES);

                    // 元のドキュメントに戻す
                    originalDoc.activate();

                    if (colorSpace === DocumentColorSpace.RGB) {
                        var fileName = placedItem.file.name;
                        results.rgbLinkedImages.push(fileName);
                    }
                } catch (e) {
                    // ファイルを開けない場合はスキップ
                    $.writeln("RGB画像チェックエラー: " + e.message);
                    // エラー時も元のドキュメントに戻す
                    try {
                        originalDoc.activate();
                    } catch (activateError) {
                        // アクティベートエラーは無視
                    }
                }
            }
        }
    } catch (e) {
        $.writeln("RGBリンク画像チェックエラー: " + e.message);
    }

    // レイヤーをスキャン
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (!layer.locked && layer.visible) {
            for (var j = 0; j < layer.pageItems.length; j++) {
                processItem(layer.pageItems[j]);
            }
        }
        currentStep++;
        updateProgress();
    }

    // アウトライン化されていないテキストチェック
    var outlineTextResult = checkModules.outlineTextCheck.checkOutlineText();
    results.outlineText = outlineTextResult.details;

    return results;
}

// メイン処理を最適化
function main() {
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
        // チェックを実行
        var results = scanDocument(progress);

        // プログレスバーを更新
        progress.progressBar.value = 100;

        // 各モジュールの結果を更新
        for (var key in checkModules) {
            try {
                if (checkModules[key] && checkModules[key].updateUI) {
                    checkModules[key].updateUI(results);
                }
            } catch (e) {
                alert("エラーが発生しました（モジュール: " + key + "）: " + e.message);
                throw e;
            }
        }
    } catch (e) {
        alert("エラーが発生しました: " + e.message);
    } finally {
        progress.close();
    }

    // ダイアログをIllustratorのドキュメントウィンドウの中央に配置
    if (app.activeDocument && app.activeDocument.windowBounds) {
        var docBounds = app.activeDocument.windowBounds;
        dialog.location = [
            docBounds[0] + (docBounds[2] - docBounds[0] - dialog.size.width) / 2,
            docBounds[1] + (docBounds[3] - docBounds[1] - dialog.size.height) / 2
        ];
    } else {
        dialog.center();
    }

    dialog.show();
}

main();