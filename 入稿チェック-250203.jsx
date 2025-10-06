// 各チェック機能のモジュール
var checkModules = {
    // アートボードの小数点チェック機能
    artboardDecimal: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // メインラベルとカウント
            var headerGroup = group.add("group");
            headerGroup.orientation = "row";
            headerGroup.alignChildren = ["left", "center"];
            headerGroup.spacing = 10;
            
            this.label = headerGroup.add("statictext", undefined, "位置，サイズに小数点のあるアートボード(px)：");
            this.resultText = headerGroup.add("statictext", undefined, "");
            this.resultText.characters = 5;
            // 赤色のペンと黒色のペンを作成
            this.redPen = this.resultText.graphics.newPen(this.resultText.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            this.blackPen = this.resultText.graphics.newPen(this.resultText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 1], 1);

            // 詳細表示（注釈スタイル）
            var detailGroup = group.add("group");
            detailGroup.orientation = "column";
            detailGroup.alignChildren = ["left", "top"];
            detailGroup.spacing = 2;
            detailGroup.margins = [16, 0, 0, 0];
            
            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 35;
            // フォントサイズを小さく、不透明度を70%に
            this.detailText.graphics.font = ScriptUI.newFont(this.detailText.graphics.font.name, "REGULAR", 10);
            this.detailText.graphics.foregroundColor = this.detailText.graphics.newPen(this.detailText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
        },

        // チェック実行
        check: function() {
            var doc = app.activeDocument;
            var hasDecimal = false;
            var decimalArtboards = [];
            
            for (var i = 0; i < doc.artboards.length; i++) {
                var artboard = doc.artboards[i];
                var rect = artboard.artboardRect;
                
                for (var j = 0; j < rect.length; j++) {
                    if (rect[j] % 1 !== 0) {
                        hasDecimal = true;
                        decimalArtboards.push(i + 1);
                        break;
                    }
                }
            }
            
            if (hasDecimal) {
                this.resultText.text = decimalArtboards.length + "個";
                this.resultText.graphics.foregroundColor = this.redPen;
                this.detailText.text = "アートボード番号：" + decimalArtboards.join(", ");
            } else {
                this.resultText.text = "0個";
                this.resultText.graphics.foregroundColor = this.blackPen;
                this.detailText.text = "";
            }
        }
    },

    // オブジェクト数チェック機能
    objectCount: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // メインラベルとカウント
            var countGroup = group.add("group");
            countGroup.orientation = "row";
            countGroup.alignChildren = ["left", "center"];
            countGroup.spacing = 10;
            
            this.label = countGroup.add("statictext", undefined, "ファイル内のオブジェクト数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // 注釈
            var noteGroup = group.add("group");
            noteGroup.orientation = "column";
            noteGroup.alignChildren = ["left", "top"];
            noteGroup.spacing = 2;
            noteGroup.margins = [16, 0, 0, 0];
            
            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ グループは1つのオブジェクトとしてカウント");
            var note2 = noteGroup.add("statictext", undefined, "※ ロックされたレイヤーとオブジェクトは除外");
            
            // フォントサイズを小さく、不透明度を70%に
            note1.graphics.font = ScriptUI.newFont(note1.graphics.font.name, "REGULAR", 10);
            note2.graphics.font = ScriptUI.newFont(note2.graphics.font.name, "REGULAR", 10);
            note1.graphics.foregroundColor = note1.graphics.newPen(note1.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
            note2.graphics.foregroundColor = note2.graphics.newPen(note2.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
        },

        // チェック実行
        check: function() {
            this.countText.text = this.countObjects() + "個";
        },

        // オブジェクトカウント処理
        countObjects: function() {
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
        }
    },

    // 使用色チェック機能
    colorCheck: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // メインラベルとカウント
            var countGroup = group.add("group");
            countGroup.orientation = "row";
            countGroup.alignChildren = ["left", "center"];
            countGroup.spacing = 10;
            
            this.label = countGroup.add("statictext", undefined, "ファイル内で使用している色数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;

            // 注釈
            var noteGroup = group.add("group");
            noteGroup.orientation = "column";
            noteGroup.alignChildren = ["left", "top"];
            noteGroup.spacing = 2;
            noteGroup.margins = [16, 0, 0, 0];
            
            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ 塗り・線の色をカウント");
            var note2 = noteGroup.add("statictext", undefined, "※ グラデーションは構成色を個別にカウント");
            var note3 = noteGroup.add("statictext", undefined, "※ 白・黒もカウント");
            
            // フォントサイズを小さく、不透明度を70%に
            note1.graphics.font = ScriptUI.newFont(note1.graphics.font.name, "REGULAR", 10);
            note2.graphics.font = ScriptUI.newFont(note2.graphics.font.name, "REGULAR", 10);
            note3.graphics.font = ScriptUI.newFont(note3.graphics.font.name, "REGULAR", 10);
            note1.graphics.foregroundColor = note1.graphics.newPen(note1.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
            note2.graphics.foregroundColor = note2.graphics.newPen(note2.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
            note3.graphics.foregroundColor = note3.graphics.newPen(note3.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
        },

        // チェック実行
        check: function() {
            this.countText.text = this.countColors() + "色";
        },

        // 色をカウントする処理
        countColors: function() {
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
        }
    },

    // CMYK小数点チェック機能
    cmykDecimalCheck: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // メインラベルとカウント
            var countGroup = group.add("group");
            countGroup.orientation = "row";
            countGroup.alignChildren = ["left", "center"];
            countGroup.spacing = 10;
            
            this.label = countGroup.add("statictext", undefined, "CMYK値に小数点がある色：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;
            // 赤色のペンと黒色のペンを作成
            this.redPen = this.countText.graphics.newPen(this.countText.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            this.blackPen = this.countText.graphics.newPen(this.countText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 1], 1);

            // 詳細表示用のグループ
            var detailGroup = group.add("group");
            detailGroup.orientation = "column";
            detailGroup.alignChildren = ["left", "top"];
            detailGroup.spacing = 2;
            detailGroup.margins = [16, 0, 0, 0];

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            // フォントサイズを小さく、不透明度を70%に
            this.detailText.graphics.font = ScriptUI.newFont(this.detailText.graphics.font.name, "REGULAR", 10);
            this.detailText.graphics.foregroundColor = this.detailText.graphics.newPen(this.detailText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);

            // 注釈
            var noteGroup = group.add("group");
            noteGroup.orientation = "column";
            noteGroup.alignChildren = ["left", "top"];
            noteGroup.spacing = 2;
            noteGroup.margins = [16, 0, 0, 0];
            
            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ 塗り・線の色をチェック");
            var note2 = noteGroup.add("statictext", undefined, "※ グラデーションの構成色もチェック");
            
            // フォントサイズを小さく、不透明度を70%に
            note1.graphics.font = ScriptUI.newFont(note1.graphics.font.name, "REGULAR", 10);
            note2.graphics.font = ScriptUI.newFont(note2.graphics.font.name, "REGULAR", 10);
            note1.graphics.foregroundColor = note1.graphics.newPen(note1.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
            note2.graphics.foregroundColor = note2.graphics.newPen(note2.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
        },

        // チェック実行
        check: function() {
            var result = this.countCMYKDecimals();
            this.countText.text = result.count + "色";
            if (result.count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = result.details.join(", ");
            } else {
                this.countText.graphics.foregroundColor = this.blackPen;
                this.detailText.text = "";
            }
        },

        // CMYK小数点をチェックする処理
        countCMYKDecimals: function() {
            var doc = app.activeDocument;
            var colorSet = {};
            var colorDetails = [];
            
            function formatCMYKValue(color) {
                function formatNumber(num) {
                    // 小数点以下が0の場合は整数表示、それ以外は小数点2桁表示
                    return (num % 1 === 0) ? num.toFixed(0) : num.toFixed(2);
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
            return {
                count: count,
                details: colorDetails
            };
        }
    },

    // ロック・非表示オブジェクトチェック機能
    lockHideCheck: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // ロックオブジェクト
            var lockGroup = group.add("group");
            lockGroup.orientation = "row";
            lockGroup.alignChildren = ["left", "center"];
            lockGroup.spacing = 10;
            
            this.lockLabel = lockGroup.add("statictext", undefined, "ロックされているオブジェクト：");
            this.lockText = lockGroup.add("statictext", undefined, "");
            this.lockText.characters = 10;
            // 赤色のペンと黒色のペンを作成
            this.redPen = this.lockText.graphics.newPen(this.lockText.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            this.blackPen = this.lockText.graphics.newPen(this.lockText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 1], 1);

            // 非表示オブジェクト
            var hideGroup = group.add("group");
            hideGroup.orientation = "row";
            hideGroup.alignChildren = ["left", "center"];
            hideGroup.spacing = 10;
            
            this.hideLabel = hideGroup.add("statictext", undefined, "非表示のオブジェクト：");
            this.hideText = hideGroup.add("statictext", undefined, "");
            this.hideText.characters = 10;

            // 注釈
            var noteGroup = group.add("group");
            noteGroup.orientation = "column";
            noteGroup.alignChildren = ["left", "top"];
            noteGroup.spacing = 2;
            noteGroup.margins = [16, 0, 0, 0];
            
            // 注釈テキストのスタイル設定
            var note1 = noteGroup.add("statictext", undefined, "※ レイヤーごとのロック・非表示は除外");
            var note2 = noteGroup.add("statictext", undefined, "※ 非表示とは「Command + 3」で隠したオブジェクト");
            
            // フォントサイズを小さく、不透明度を70%に
            note1.graphics.font = ScriptUI.newFont(note1.graphics.font.name, "REGULAR", 10);
            note2.graphics.font = ScriptUI.newFont(note2.graphics.font.name, "REGULAR", 10);
            note1.graphics.foregroundColor = note1.graphics.newPen(note1.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
            note2.graphics.foregroundColor = note2.graphics.newPen(note2.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
        },

        // チェック実行
        check: function() {
            var counts = this.countLockHideObjects();
            this.lockText.text = counts.locked + "個";
            this.hideText.text = counts.hidden + "個";
            
            if (counts.locked > 0) {
                this.lockText.graphics.foregroundColor = this.redPen;
            } else {
                this.lockText.graphics.foregroundColor = this.blackPen;
            }
            
            if (counts.hidden > 0) {
                this.hideText.graphics.foregroundColor = this.redPen;
            } else {
                this.hideText.graphics.foregroundColor = this.blackPen;
            }
        },

        // ロック・非表示オブジェクトをカウントする処理
        countLockHideObjects: function() {
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
        }
    },

    // フォントチェック機能
    fontCheck: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // メインラベルとカウント
            var countGroup = group.add("group");
            countGroup.orientation = "row";
            countGroup.alignChildren = ["left", "center"];
            countGroup.spacing = 10;
            
            this.label = countGroup.add("statictext", undefined, "使用フォント数：");
            this.countText = countGroup.add("statictext", undefined, "");
            this.countText.characters = 10;
            // 赤色のペンと黒色のペンを作成
            this.redPen = this.countText.graphics.newPen(this.countText.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            this.blackPen = this.countText.graphics.newPen(this.countText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 1], 1);

            // フォント名表示用のグループ
            var detailGroup = group.add("group");
            detailGroup.orientation = "column";
            detailGroup.alignChildren = ["left", "top"];
            detailGroup.spacing = 2;
            detailGroup.margins = [16, 0, 0, 0];

            this.detailText = detailGroup.add("statictext", undefined, "");
            this.detailText.characters = 50;
            // フォントサイズを小さく、不透明度を70%に
            this.detailText.graphics.font = ScriptUI.newFont(this.detailText.graphics.font.name, "REGULAR", 10);
            this.detailText.graphics.foregroundColor = this.detailText.graphics.newPen(this.detailText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.7], 1);
        },

        // チェック実行
        check: function() {
            var result = this.countFonts();
            this.countText.text = result.count + "種類";
            if (result.count > 0) {
                this.countText.graphics.foregroundColor = this.redPen;
                this.detailText.text = result.fontNames.join(", ");
            } else {
                this.countText.graphics.foregroundColor = this.blackPen;
                this.detailText.text = "";
            }
        },

        // フォントをチェックする処理
        countFonts: function() {
            var doc = app.activeDocument;
            var fontSet = {};
            
            function checkTextItem(item) {
                if (item.typename === "TextFrame") {
                    // TextFrameの場合は、テキストレンジを取得して各文字のフォントをチェック
                    var textRange = item.textRange;
                    for (var i = 0; i < textRange.length; i++) {
                        var font = textRange.characters[i].textFont;
                        if (font) {
                            fontSet[font.name] = true;
                        }
                    }
                }
                
                // グループ内のアイテムをチェック
                if (item.typename === "GroupItem") {
                    for (var i = 0; i < item.pageItems.length; i++) {
                        checkTextItem(item.pageItems[i]);
                    }
                }
            }

            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    for (var j = 0; j < layer.pageItems.length; j++) {
                        checkTextItem(layer.pageItems[j]);
                    }
                }
            }

            // フォント名の配列を作成
            var fontNames = [];
            for (var name in fontSet) {
                fontNames.push(name);
            }
            
            // フォント名でソート
            fontNames.sort();

            return {
                count: fontNames.length,
                fontNames: fontNames
            };
        }
    },

    // 不要なオブジェクトチェック機能
    unnecessaryObjectCheck: {
        // UI要素
        createUI: function(parent) {
            var group = parent.add("group");
            group.orientation = "column";
            group.alignChildren = ["left", "top"];
            group.spacing = 10;

            // 孤立点
            var strayGroup = group.add("group");
            strayGroup.orientation = "row";
            strayGroup.alignChildren = ["left", "center"];
            strayGroup.spacing = 10;
            
            this.strayLabel = strayGroup.add("statictext", undefined, "孤立点：");
            this.strayText = strayGroup.add("statictext", undefined, "");
            this.strayText.characters = 10;

            // 塗りなしオブジェクト
            var noFillGroup = group.add("group");
            noFillGroup.orientation = "row";
            noFillGroup.alignChildren = ["left", "center"];
            noFillGroup.spacing = 10;
            
            this.noFillLabel = noFillGroup.add("statictext", undefined, "塗りのないオブジェクト：");
            this.noFillText = noFillGroup.add("statictext", undefined, "");
            this.noFillText.characters = 10;

            // 空テキストパス
            var emptyTextGroup = group.add("group");
            emptyTextGroup.orientation = "row";
            emptyTextGroup.alignChildren = ["left", "center"];
            emptyTextGroup.spacing = 10;
            
            this.emptyTextLabel = emptyTextGroup.add("statictext", undefined, "空のテキストパス：");
            this.emptyTextText = emptyTextGroup.add("statictext", undefined, "");
            this.emptyTextText.characters = 10;

            // 赤色のペンと黒色のペンを作成
            this.redPen = this.strayText.graphics.newPen(this.strayText.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            this.blackPen = this.strayText.graphics.newPen(this.strayText.graphics.PenType.SOLID_COLOR, [0, 0, 0, 1], 1);

            // 削除ボタン
            var buttonGroup = group.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignChildren = ["left", "center"];
            buttonGroup.spacing = 10;
            buttonGroup.margins = [0, 10, 0, 0];

            this.deleteButton = buttonGroup.add("button", undefined, "削除");
            this.deleteButton.enabled = false;

            var self = this;
            this.deleteButton.onClick = function() {
                self.deleteUnnecessaryObjects();
                self.check(); // 再チェック
            };
        },

        // チェック実行
        check: function() {
            var counts = this.countUnnecessaryObjects();
            
            // 孤立点
            this.strayText.text = counts.strayPoints + "個";
            if (counts.strayPoints > 0) {
                this.strayText.graphics.foregroundColor = this.redPen;
            } else {
                this.strayText.graphics.foregroundColor = this.blackPen;
            }

            // 塗りなしオブジェクト
            this.noFillText.text = counts.noFill + "個";
            if (counts.noFill > 0) {
                this.noFillText.graphics.foregroundColor = this.redPen;
            } else {
                this.noFillText.graphics.foregroundColor = this.blackPen;
            }

            // 空テキストパス
            this.emptyTextText.text = counts.emptyText + "個";
            if (counts.emptyText > 0) {
                this.emptyTextText.graphics.foregroundColor = this.redPen;
            } else {
                this.emptyTextText.graphics.foregroundColor = this.blackPen;
            }

            // 削除ボタンの有効/無効を設定
            this.deleteButton.enabled = (counts.strayPoints > 0 || counts.noFill > 0 || counts.emptyText > 0);
        },

        // 不要なオブジェクトをカウントする処理
        countUnnecessaryObjects: function() {
            var doc = app.activeDocument;
            var strayPoints = 0;
            var noFill = 0;
            var emptyText = 0;
            
            function checkItems(container) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var item = container.pageItems[i];
                    
                    // 孤立点のチェック
                    if (item.typename === "PathItem" && item.pathPoints.length === 1) {
                        strayPoints++;
                    }
                    
                    // 塗りなしオブジェクトのチェック
                    if (item.typename === "PathItem" && !item.filled && !item.stroked) {
                        noFill++;
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
            
            return {
                strayPoints: strayPoints,
                noFill: noFill,
                emptyText: emptyText
            };
        },

        // 不要なオブジェクトを削除する処理
        deleteUnnecessaryObjects: function() {
            var doc = app.activeDocument;
            
            function removeItems(container) {
                // 後ろから処理することで、インデックスのズレを防ぐ
                for (var i = container.pageItems.length - 1; i >= 0; i--) {
                    var item = container.pageItems[i];
                    
                    // グループ内のアイテムを先に処理
                    if (item.typename === "GroupItem") {
                        removeItems(item);
                        // グループが空になった場合は削除
                        if (item.pageItems.length === 0) {
                            item.remove();
                        }
                        continue;
                    }
                    
                    // 孤立点の削除
                    if (item.typename === "PathItem" && item.pathPoints.length === 1) {
                        item.remove();
                        continue;
                    }
                    
                    // 塗りなしオブジェクトの削除
                    if (item.typename === "PathItem" && !item.filled && !item.stroked) {
                        item.remove();
                        continue;
                    }
                    
                    // 空テキストパスの削除
                    if (item.typename === "TextFrame" && item.textRange.length === 0) {
                        item.remove();
                        continue;
                    }
                }
            }
            
            // すべてのレイヤーのアイテムをチェック
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                if (!layer.locked && layer.visible) {
                    removeItems(layer);
                }
            }
        }
    }
};

// メインダイアログの作成
function createDialog() {
    var dialog = new Window("dialog", "入稿チェックパネル");
    dialog.preferredSize.width = 300;
    dialog.preferredSize.height = 200;

    var mainGroup = dialog.add("group");
    mainGroup.orientation = "column";
    mainGroup.alignChildren = ["left", "top"];
    mainGroup.spacing = 10;
    mainGroup.margins = 16;

    // 各モジュールのUI作成
    var isFirst = true;
    for (var key in checkModules) {
        if (!isFirst) {
            // 区切り線を追加
            var separator = mainGroup.add("panel");
            separator.alignment = "fill";
            separator.height = 1;
        }
        isFirst = false;
        
        checkModules[key].createUI(mainGroup);
    }

    // 最後の区切り線
    var lastSeparator = mainGroup.add("panel");
    lastSeparator.alignment = "fill";
    lastSeparator.height = 1;

    // ボタン
    var buttonGroup = mainGroup.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignChildren = ["center", "center"];
    buttonGroup.spacing = 10;
    buttonGroup.margins = [0, 10, 0, 0]; // 上部に余白を追加

    var okButton = buttonGroup.add("button", undefined, "OK");
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル");

    okButton.onClick = function() { dialog.close(); }
    cancelButton.onClick = function() { dialog.close(); }

    return dialog;
}

// メイン処理
function main() {
    var dialog = createDialog();
    
    // 各モジュールのチェック実行
    for (var key in checkModules) {
        checkModules[key].check();
    }
    
    dialog.center();
    dialog.show();
}

main();