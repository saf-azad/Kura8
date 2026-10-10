/* @ds-bundle: {"format":4,"namespace":"PaperWireframeDesignSystem_72d81a","components":[{"name":"DiamondGrid","sourcePath":"components/collections/DiamondGrid.jsx"},{"name":"ListRow","sourcePath":"components/collections/ListRow.jsx"},{"name":"ProductRow","sourcePath":"components/collections/ProductRow.jsx"},{"name":"Rating","sourcePath":"components/collections/Rating.jsx"},{"name":"SelectGrid","sourcePath":"components/collections/SelectGrid.jsx"},{"name":"StatRow","sourcePath":"components/collections/StatRow.jsx"},{"name":"TileRow","sourcePath":"components/collections/TileRow.jsx"},{"name":"Button","sourcePath":"components/controls/Button.jsx"},{"name":"CheckCircle","sourcePath":"components/controls/CheckCircle.jsx"},{"name":"ChoiceRow","sourcePath":"components/controls/ChoiceRow.jsx"},{"name":"CodeInput","sourcePath":"components/controls/CodeInput.jsx"},{"name":"IconButton","sourcePath":"components/controls/IconButton.jsx"},{"name":"Input","sourcePath":"components/controls/Input.jsx"},{"name":"NumberGrid","sourcePath":"components/controls/NumberGrid.jsx"},{"name":"ProgressPill","sourcePath":"components/controls/ProgressPill.jsx"},{"name":"RangeSlider","sourcePath":"components/controls/RangeSlider.jsx"},{"name":"SearchBar","sourcePath":"components/controls/SearchBar.jsx"},{"name":"Slider","sourcePath":"components/controls/Slider.jsx"},{"name":"Stepper","sourcePath":"components/controls/Stepper.jsx"},{"name":"Switch","sourcePath":"components/controls/Switch.jsx"},{"name":"VerticalSlider","sourcePath":"components/controls/VerticalSlider.jsx"},{"name":"BottomSheet","sourcePath":"components/frame/BottomSheet.jsx"},{"name":"Keyboard","sourcePath":"components/frame/Keyboard.jsx"},{"name":"Keypad","sourcePath":"components/frame/Keypad.jsx"},{"name":"PhoneFrame","sourcePath":"components/frame/PhoneFrame.jsx"},{"name":"ScreenHeader","sourcePath":"components/frame/ScreenHeader.jsx"},{"name":"TabBar","sourcePath":"components/frame/TabBar.jsx"},{"name":"Icon","sourcePath":"components/icon/Icon.jsx"},{"name":"Carousel","sourcePath":"components/media/Carousel.jsx"},{"name":"MediaBlock","sourcePath":"components/media/MediaBlock.jsx"},{"name":"MediaCard","sourcePath":"components/media/MediaCard.jsx"},{"name":"ProgressRing","sourcePath":"components/media/ProgressRing.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"DiamondTile","sourcePath":"components/surfaces/DiamondTile.jsx"},{"name":"Panel","sourcePath":"components/surfaces/Panel.jsx"},{"name":"Tile","sourcePath":"components/surfaces/Tile.jsx"},{"name":"TextBar","sourcePath":"components/text/TextBar.jsx"},{"name":"TextBlock","sourcePath":"components/text/TextBlock.jsx"},{"name":"TitleBlock","sourcePath":"components/text/TitleBlock.jsx"}],"sourceHashes":{"components/collections/DiamondGrid.jsx":"3f8a7ec0933d","components/collections/ListRow.jsx":"3f9e7eb79abb","components/collections/ProductRow.jsx":"17cea1e93a59","components/collections/Rating.jsx":"6ed1f735ced6","components/collections/SelectGrid.jsx":"6597e76c4701","components/collections/StatRow.jsx":"8829b5b08ae3","components/collections/TileRow.jsx":"831749f6672d","components/controls/Button.jsx":"707e7ccdb568","components/controls/CheckCircle.jsx":"6adf23fdd7a3","components/controls/ChoiceRow.jsx":"8e264e400ff3","components/controls/CodeInput.jsx":"867001e1051b","components/controls/IconButton.jsx":"1c82a9e61d75","components/controls/Input.jsx":"db19a9851f75","components/controls/NumberGrid.jsx":"6c1c6bf01f93","components/controls/ProgressPill.jsx":"0e2ddb32f73c","components/controls/RangeSlider.jsx":"9c5e4b2354b6","components/controls/SearchBar.jsx":"91610ed99924","components/controls/Slider.jsx":"cb85ee50d105","components/controls/Stepper.jsx":"7f86db7de133","components/controls/Switch.jsx":"e9a88a60e870","components/controls/VerticalSlider.jsx":"f0b660c0d5e7","components/frame/BottomSheet.jsx":"42b3e4573996","components/frame/Keyboard.jsx":"b59d0c1493b7","components/frame/Keypad.jsx":"170fe45c5a44","components/frame/PhoneFrame.jsx":"1ffed7b291e5","components/frame/ScreenHeader.jsx":"0e832ed7c2a3","components/frame/TabBar.jsx":"e2033a4ce7c1","components/icon/Icon.jsx":"322bf8780c5c","components/media/Carousel.jsx":"abd3470ae024","components/media/MediaBlock.jsx":"fc8641f817b7","components/media/MediaCard.jsx":"cbc041e8dd3e","components/media/ProgressRing.jsx":"26d71e263a06","components/surfaces/Card.jsx":"8336c8062d82","components/surfaces/DiamondTile.jsx":"f5fa934584ff","components/surfaces/Panel.jsx":"a7dbece273e9","components/surfaces/Tile.jsx":"d49606fe4e64","components/text/TextBar.jsx":"5e601e005a09","components/text/TextBlock.jsx":"a69b0dc6519d","components/text/TitleBlock.jsx":"44d3f8ec2c51","ui_kits/mobile-flows/BrowseScreen.jsx":"7b8efd5722b2","ui_kits/mobile-flows/CatalogueScreen.jsx":"277ec67090ff","ui_kits/mobile-flows/PickerScreen.jsx":"8bbab152a443","ui_kits/mobile-flows/SavedScreen.jsx":"86b17a1cdc75","ui_kits/mobile-flows/SettingsSheetScreen.jsx":"da22932080d9","ui_kits/mobile-flows/SignInScreen.jsx":"a5355c9f2b55","ui_kits/mobile-flows/TunerScreen.jsx":"281e56796f6e"},"inlinedExternals":[],"unexposedExports":[{"name":"glyphNames","sourcePath":"components/icon/Icon.jsx"},{"name":"glyphs","sourcePath":"components/icon/Icon.jsx"}]} */

(() => {

const __ds_ns = (window.PaperWireframeDesignSystem_72d81a = window.PaperWireframeDesignSystem_72d81a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/collections/Rating.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Rating. Small diamonds — filled ink for earned, hollow for the rest. The source shows
   two of these side by side, each six diamonds wide. */
function Rating({
  value = 4,
  max = 6,
  size = 9,
  gap = 6,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: `${gap}px`,
      alignItems: "center",
      ...style
    }
  }, rest), Array.from({
    length: max
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: `${size}px`,
      height: `${size}px`,
      transform: "rotate(45deg)",
      flex: "none",
      background: i < value ? "var(--ink)" : "transparent",
      border: i < value ? "none" : "1.5px solid var(--ink)"
    }
  })));
}
Object.assign(__ds_scope, { Rating });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/Rating.jsx", error: String((e && e.message) || e) }); }

// components/collections/TileRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Horizontal rail. Starts 5px outside the content column and runs off the right edge of the
   screen, so the last item is visibly clipped — that clipping is how the kit signals scroll. */
function TileRow({
  children,
  gap = 32,
  bleed = 5,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: `${gap}px`,
      marginLeft: `${-bleed}px`,
      marginRight: `${-45 - bleed}px`,
      paddingRight: "45px",
      overflow: "hidden",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { TileRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/TileRow.jsx", error: String((e && e.message) || e) }); }

// components/controls/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The pill. 255×60 at radius 30 in the source — solid ink for the primary action,
   a bare 2px outline for the secondary, opaque #D0D8E2 when disabled.
   Wireframe buttons usually carry no label; children are optional. */
function Button({
  children,
  variant = "solid",
  w = 255,
  h = 60,
  full = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const base = {
    width: full ? "100%" : typeof w === "number" ? `${w}px` : w,
    height: `${h}px`,
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    font: `500 var(--text-md)/1 var(--font-sans)`,
    letterSpacing: "0.01em",
    padding: "0 24px",
    flex: "none",
    cursor: disabled ? "default" : "pointer",
    transition: "var(--transition-state)"
  };
  const skin = disabled ? {
    background: "var(--fill)",
    border: "2px solid transparent",
    color: "var(--ink-a50)"
  } : variant === "outline" ? {
    background: "transparent",
    border: "2px solid var(--ink)",
    color: "var(--ink)"
  } : variant === "soft" ? {
    background: "var(--fill)",
    border: "2px solid var(--ink)",
    color: "var(--ink)"
  } : {
    background: "var(--ink)",
    border: "2px solid var(--ink)",
    color: "var(--white)"
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    style: {
      ...base,
      ...skin,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Button.jsx", error: String((e && e.message) || e) }); }

// components/controls/CodeInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* One-time-code field. Four 48px boxes at radius 9; an empty box shows a 20×2 dash, a
   filled one shows the digit in Space Grotesk. */
function CodeInput({
  length = 4,
  value = "",
  box = 48,
  gap = 14,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: `${gap}px`,
      justifyContent: "center",
      ...style
    }
  }, rest), Array.from({
    length
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: `${box}px`,
      height: `${box}px`,
      borderRadius: "9px",
      border: "2px solid var(--ink)",
      display: "grid",
      placeItems: "center",
      font: "400 20px/1 var(--font-sans)",
      color: "var(--ink)",
      flex: "none"
    }
  }, value[i] ? value[i] : /*#__PURE__*/React.createElement("span", {
    style: {
      width: "20px",
      height: "2px",
      background: "var(--ink-a50)"
    }
  }))));
}
Object.assign(__ds_scope, { CodeInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/CodeInput.jsx", error: String((e && e.message) || e) }); }

// components/controls/NumberGrid.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Date / number grid. Seven columns of 30px cells at radius 9 with a 2px ink stroke; the
   selected cell fills ink and its numeral goes white. Space Grotesk at 13px. */
function NumberGrid({
  count = 30,
  start = 1,
  selected = 18,
  onSelect,
  columns = 7,
  cell = 30,
  gap = 12,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${columns},${cell}px)`,
      gap: `${gap}px`,
      justifyContent: "space-between",
      ...style
    }
  }, rest), Array.from({
    length: count
  }, (_, i) => {
    const n = start + i;
    const on = n === selected;
    return /*#__PURE__*/React.createElement("button", {
      key: n,
      type: "button",
      "aria-pressed": on,
      onClick: onSelect ? () => onSelect(n) : undefined,
      style: {
        width: `${cell}px`,
        height: `${cell}px`,
        borderRadius: "9px",
        border: "2px solid var(--ink)",
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--white)" : "var(--ink)",
        font: "400 13px/1 var(--font-sans)",
        display: "grid",
        placeItems: "center",
        padding: 0,
        cursor: onSelect ? "pointer" : "default",
        transition: "var(--transition-state)"
      }
    }, n);
  }));
}
Object.assign(__ds_scope, { NumberGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/NumberGrid.jsx", error: String((e && e.message) || e) }); }

// components/controls/ProgressPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The split pill. A 48px outline pill whose fill runs from one end to the given fraction.
   The source uses it as both a progress bar and a two-way segmented control, filling from
   the left on some screens and the right on others. */
function ProgressPill({
  value = 0.5,
  align = "start",
  h = 48,
  radius = 999,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      height: `${h}px`,
      borderRadius: `${radius}px`,
      border: "2px solid var(--ink)",
      overflow: "hidden",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 0,
      bottom: 0,
      [align === "end" ? "right" : "left"]: 0,
      width: `${Math.max(0, Math.min(1, value)) * 100}%`,
      background: "var(--ink)",
      borderRadius: `${radius}px`,
      transition: `width var(--dur-base) var(--ease-standard)`
    }
  }));
}
Object.assign(__ds_scope, { ProgressPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/ProgressPill.jsx", error: String((e && e.message) || e) }); }

// components/controls/Slider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Horizontal slider. A 24px track at radius 12 carrying a slate→paper gradient, with a
   16px outline knob. The gradient direction flips with `invert`, as it does in the source. */
function Slider({
  value = 0.5,
  onChange,
  h = 24,
  invert = false,
  style,
  ...rest
}) {
  const v = Math.max(0, Math.min(1, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onChange ? e => {
      const r = e.currentTarget.getBoundingClientRect();
      onChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    } : undefined,
    role: "slider",
    "aria-valuenow": Math.round(v * 100),
    style: {
      position: "relative",
      height: `${h}px`,
      borderRadius: `${h / 2}px`,
      border: "2px solid var(--ink)",
      background: invert ? "linear-gradient(90deg,var(--paper) 0%,var(--slate) 100%)" : "linear-gradient(90deg,var(--slate) 0%,var(--paper) 100%)",
      cursor: onChange ? "pointer" : "default",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "50%",
      left: `calc(${v * 100}% )`,
      transform: "translate(-50%,-50%)",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      transition: `left var(--dur-fast) var(--ease-standard)`
    }
  }));
}
Object.assign(__ds_scope, { Slider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Slider.jsx", error: String((e && e.message) || e) }); }

// components/controls/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Switch. 48×23 track at radius 11.5 with a 2px ink stroke. On: 24px ink knob at the
   right. Off: 23px outline knob at the left. Nothing else changes — the track never fills. */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: onChange ? () => onChange(!checked) : undefined,
    style: {
      position: "relative",
      width: "48px",
      height: "23px",
      borderRadius: "11.5px",
      border: "2px solid var(--ink)",
      background: "transparent",
      padding: 0,
      flex: "none",
      opacity: disabled ? 0.4 : 1,
      cursor: onChange && !disabled ? "pointer" : "default",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "50%",
      left: checked ? "calc(100% - 12px)" : "12px",
      transform: "translate(-50%,-50%)",
      width: checked ? "24px" : "23px",
      height: checked ? "24px" : "23px",
      borderRadius: "50%",
      background: checked ? "var(--ink)" : "transparent",
      border: checked ? "none" : "2px solid var(--ink)",
      transition: `left var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard)`
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Switch.jsx", error: String((e && e.message) || e) }); }

// components/controls/VerticalSlider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Vertical slider. A 22px-wide track at radius 11 with a vertical slate→paper gradient
   and a 16px outline knob. The source shows five of them side by side as a mixer. */
function VerticalSlider({
  value = 0.5,
  onChange,
  w = 22,
  h = 260,
  invert = false,
  style,
  ...rest
}) {
  const v = Math.max(0, Math.min(1, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onChange ? e => {
      const r = e.currentTarget.getBoundingClientRect();
      onChange(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)));
    } : undefined,
    role: "slider",
    "aria-orientation": "vertical",
    "aria-valuenow": Math.round(v * 100),
    style: {
      position: "relative",
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: `${w / 2}px`,
      border: "2px solid var(--ink)",
      background: invert ? "linear-gradient(180deg,var(--slate) 0%,var(--paper) 100%)" : "linear-gradient(180deg,var(--paper) 0%,var(--slate) 100%)",
      flex: "none",
      cursor: onChange ? "pointer" : "default",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: "50%",
      bottom: `calc(${v * 100}%)`,
      transform: "translate(-50%,50%)",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      transition: `bottom var(--dur-fast) var(--ease-standard)`
    }
  }));
}
Object.assign(__ds_scope, { VerticalSlider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/VerticalSlider.jsx", error: String((e && e.message) || e) }); }

// components/frame/BottomSheet.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Bottom sheet. Full-width panel, 2px ink stroke, 49px radius all round with the bottom
   corners pushed past the device edge, and a 50×5 handle 8px from the top. */
function BottomSheet({
  children,
  h = 350,
  open = true,
  gutter = 45,
  handle = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "absolute",
      left: "-2px",
      right: "-2px",
      bottom: "-2px",
      height: `${h}px`,
      borderRadius: "49px",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      paddingLeft: `${gutter}px`,
      paddingRight: `${gutter}px`,
      paddingTop: "46px",
      transform: open ? "translateY(0)" : `translateY(${h + 4}px)`,
      transition: `transform var(--dur-sheet) var(--ease-sheet)`,
      display: "flex",
      flexDirection: "column",
      ...style
    }
  }, rest), handle ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "8px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "50px",
      height: "5px",
      borderRadius: "2.5px",
      background: "var(--ink)"
    }
  }) : null, children);
}
Object.assign(__ds_scope, { BottomSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/frame/BottomSheet.jsx", error: String((e && e.message) || e) }); }

// components/frame/PhoneFrame.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The device shell. 375×812, 2px ink stroke, 50px radius, paper fill, nothing outside it.
   Content is inset 45px on each side (a 285px column); pass bleed to opt out for rails. */
function PhoneFrame({
  children,
  w = 375,
  h = 812,
  gutter = 45,
  top = 80,
  scale = 1,
  style,
  contentStyle,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      width: `${w}px`,
      height: `${h}px`,
      flex: "none",
      borderRadius: "50px",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      overflow: "hidden",
      fontFamily: "var(--font-sans)",
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transformOrigin: "top left",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      paddingLeft: `${gutter}px`,
      paddingRight: `${gutter}px`,
      paddingTop: `${top}px`,
      display: "flex",
      flexDirection: "column",
      ...contentStyle
    }
  }, children));
}
Object.assign(__ds_scope, { PhoneFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/frame/PhoneFrame.jsx", error: String((e && e.message) || e) }); }

// components/icon/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Glyphs extracted verbatim from the source wireframe SVGs (assets/icons/*.svg).
   Each entry is [viewBox, innerMarkup]. Paint is currentColor throughout. */
const glyphs = {
  "arrow-left": ["46.40 63.04 25.10 17.92", "<path d=\"M69 71C69.5523 71 70 71.4477 70 72C70 72.5523 69.5523 73 69 73V71ZM48.2929 72.7071C47.9024 72.3166 47.9024 71.6834 48.2929 71.2929L54.6569 64.9289C55.0474 64.5384 55.6805 64.5384 56.0711 64.9289C56.4616 65.3195 56.4616 65.9526 56.0711 66.3431L50.4142 72L56.0711 77.6569C56.4616 78.0474 56.4616 78.6805 56.0711 79.0711C55.6805 79.4616 55.0474 79.4616 54.6569 79.0711L48.2929 72.7071ZM69 73H49V71H69V73Z\" fill=\"currentColor\"></path>"],
  "arrow-right": ["174.00 468.04 28.10 17.92", "<path d=\"M176.5 476C175.948 476 175.5 476.448 175.5 477C175.5 477.552 175.948 478 176.5 478V476ZM200.207 477.707C200.598 477.317 200.598 476.683 200.207 476.293L193.843 469.929C193.453 469.538 192.819 469.538 192.429 469.929C192.038 470.319 192.038 470.953 192.429 471.343L198.086 477L192.429 482.657C192.038 483.047 192.038 483.681 192.429 484.071C192.819 484.462 193.453 484.462 193.843 484.071L200.207 477.707ZM176.5 478H199.5V476H176.5V478Z\" fill=\"currentColor\"></path>"],
  "asterisk": ["273.87 689.94 37.54 38.48", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M284.874 726.914C284.329 726.914 283.887 726.461 283.887 725.901L283.887 718.161L276.352 718.161C275.807 718.161 275.366 717.708 275.366 717.148C275.366 716.588 275.807 716.135 276.352 716.135L284.107 716.135C284.155 716.032 284.22 715.936 284.302 715.85L286.474 713.62L280.773 713.62C280.228 713.62 279.787 713.167 279.787 712.607C279.787 712.047 280.228 711.594 280.773 711.594L288.447 711.594L291.196 708.769L289.239 706.759H280.773C280.228 706.759 279.787 706.306 279.787 705.746C279.787 705.186 280.228 704.733 280.773 704.733L287.266 704.733L284.819 702.219H276.352C275.807 702.219 275.365 701.765 275.365 701.205C275.365 700.646 275.807 700.192 276.352 700.192L283.887 700.192L283.887 692.453C283.887 691.893 284.329 691.439 284.874 691.439C285.419 691.439 285.86 691.893 285.86 692.453L285.86 700.434C285.893 700.461 285.925 700.489 285.956 700.52L288.308 702.937V696.993C288.308 696.433 288.75 695.98 289.295 695.98C289.84 695.98 290.281 696.433 290.281 696.993L290.281 704.964L292.592 707.336L294.988 704.875L294.988 696.993C294.988 696.433 295.43 695.98 295.975 695.98C296.52 695.98 296.961 696.433 296.961 696.993L296.961 702.848L299.409 700.334L299.409 692.452C299.409 691.893 299.851 691.439 300.396 691.439C300.941 691.439 301.382 691.893 301.382 692.452L301.382 700.192L308.917 700.192C309.462 700.192 309.904 700.645 309.904 701.205C309.904 701.765 309.462 702.218 308.917 702.218L300.396 702.218L300.377 702.218L300.365 702.218L297.917 704.732L304.497 704.732C305.041 704.732 305.483 705.186 305.483 705.746C305.483 706.305 305.041 706.759 304.497 706.759L295.975 706.759C295.965 706.759 295.955 706.759 295.945 706.759L293.987 708.769L296.736 711.594L304.495 711.594C305.04 711.594 305.482 712.047 305.482 712.607C305.482 713.166 305.04 713.62 304.495 713.62L298.709 713.62L301.158 716.135L308.917 716.135C309.461 716.135 309.903 716.588 309.903 717.148C309.903 717.708 309.461 718.161 308.917 718.161L301.381 718.161L301.381 725.901C301.381 726.46 300.94 726.914 300.395 726.914C299.85 726.914 299.408 726.46 299.408 725.901L299.408 717.204L296.96 714.69L296.96 721.36C296.96 721.919 296.519 722.373 295.974 722.373C295.429 722.373 294.987 721.919 294.987 721.36V712.663L292.592 710.202L290.281 712.576C290.281 712.586 290.282 712.597 290.282 712.607L290.282 721.36C290.282 721.919 289.84 722.373 289.295 722.373C288.75 722.373 288.308 721.919 288.308 721.36V714.602L285.86 717.117L285.86 717.13L285.86 717.148L285.86 725.901C285.86 726.461 285.419 726.914 284.874 726.914Z\" fill=\"currentColor\"></path>"],
  "backspace": ["331.43 651.67 26.87 20.65", "<path d=\"M341.1 670.826C340.817 670.826 340.548 670.706 340.358 670.497L333.277 662.671C332.933 662.29 332.933 661.71 333.277 661.329L340.358 653.503C340.548 653.294 340.817 653.174 341.1 653.174L355.8 653.174C356.353 653.174 356.8 653.622 356.8 654.174L356.8 669.826C356.8 670.378 356.353 670.826 355.8 670.826L341.1 670.826Z\" fill=\"#D0D8E2\"></path><path d=\"M343.507 658.077L351.537 666.107M351.537 658.077L343.507 666.107M333.277 662.671L340.358 670.497C340.548 670.706 340.817 670.826 341.1 670.826L355.8 670.826C356.353 670.826 356.8 670.378 356.8 669.826L356.8 654.174C356.8 653.622 356.353 653.174 355.8 653.174L341.1 653.174C340.817 653.174 340.548 653.294 340.358 653.503L333.277 661.329C332.933 661.71 332.933 662.29 333.277 662.671Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"></path>"],
  "blob-two": ["175.68 526.25 24.51 28.65", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M192.655 540.552L194.71 538.147C198.036 534.253 195.269 528.25 190.147 528.25H185.838C180.585 528.25 177.868 534.522 181.46 538.354L183.388 540.41C183.332 540.471 183.276 540.534 183.222 540.598L181.167 543.003C177.841 546.897 180.608 552.9 185.729 552.9H190.039C195.291 552.9 198.009 546.628 194.416 542.796L192.488 540.74C192.545 540.679 192.6 540.616 192.655 540.552Z\" fill=\"currentColor\"></path><path d=\"M194.71 538.147L195.09 538.472V538.472L194.71 538.147ZM192.655 540.552L193.035 540.877H193.035L192.655 540.552ZM181.46 538.354L181.096 538.696H181.096L181.46 538.354ZM183.388 540.41L183.755 540.75L184.072 540.408L183.753 540.068L183.388 540.41ZM183.222 540.598L182.841 540.273L182.841 540.273L183.222 540.598ZM181.167 543.003L180.787 542.678V542.678L181.167 543.003ZM194.416 542.796L194.051 543.138V543.138L194.416 542.796ZM192.488 540.74L192.121 540.4L191.804 540.742L192.123 541.082L192.488 540.74ZM194.329 537.822L192.275 540.228L193.035 540.877L195.09 538.472L194.329 537.822ZM190.147 528.75C194.842 528.75 197.378 534.253 194.329 537.822L195.09 538.472C198.693 534.253 195.695 527.75 190.147 527.75V528.75ZM185.838 528.75H190.147V527.75H185.838V528.75ZM181.825 538.012C178.532 534.499 181.023 528.75 185.838 528.75V527.75C180.147 527.75 177.204 534.544 181.096 538.696L181.825 538.012ZM183.753 540.068L181.825 538.012L181.096 538.696L183.024 540.752L183.753 540.068ZM183.602 540.922C183.652 540.864 183.703 540.806 183.755 540.75L183.022 540.07C182.961 540.136 182.9 540.204 182.841 540.273L183.602 540.922ZM181.547 543.328L183.602 540.922L182.841 540.273L180.787 542.678L181.547 543.328ZM185.729 552.4C181.035 552.4 178.498 546.897 181.547 543.328L180.787 542.678C177.183 546.897 180.181 553.4 185.729 553.4V552.4ZM190.039 552.4H185.729V553.4H190.039V552.4ZM194.051 543.138C197.344 546.651 194.854 552.4 190.039 552.4V553.4C195.729 553.4 198.673 546.606 194.781 542.454L194.051 543.138ZM192.123 541.082L194.051 543.138L194.781 542.454L192.853 540.398L192.123 541.082ZM192.275 540.228C192.225 540.286 192.173 540.344 192.121 540.4L192.855 541.08C192.916 541.014 192.976 540.946 193.035 540.877L192.275 540.228Z\" fill=\"currentColor\"></path>"],
  "blossom": ["283.45 528.52 25.10 24.02", "<path d=\"M293.147 532.781C294.045 530.017 297.955 530.017 298.853 532.781L299.143 533.674C299.545 534.91 300.697 535.747 301.996 535.747H302.935C305.841 535.747 307.049 539.466 304.698 541.174L303.939 541.725C302.888 542.489 302.448 543.843 302.849 545.08L303.139 545.972C304.037 548.736 300.874 551.034 298.523 549.326L297.763 548.775C296.712 548.011 295.288 548.011 294.237 548.775L293.477 549.326C291.126 551.034 287.963 548.736 288.861 545.972L289.151 545.08C289.552 543.843 289.112 542.489 288.061 541.725L287.302 541.174C284.951 539.466 286.159 535.747 289.065 535.747H290.004C291.303 535.747 292.455 534.91 292.857 533.674L293.147 532.781Z\" fill=\"currentColor\" stroke=\"currentColor\"></path>"],
  "bottle": ["73.50 687.50 23.00 42.00", "<path d=\"M90.4347 700.826L89.8303 701.622V701.622L90.4347 700.826ZM83 692C83 691.448 83.4477 691 84 691V689C82.3431 689 81 690.343 81 692H83ZM83 698.805V692H81V698.805H83ZM77 708C77 704.741 78.9493 701.934 81.7499 700.687L80.9365 698.86C77.4406 700.417 75 703.922 75 708H77ZM77 723V708H75V723H77ZM80 726C78.3431 726 77 724.657 77 723H75C75 725.761 77.2386 728 80 728V726ZM90 726H80V728H90V726ZM93 723C93 724.657 91.6569 726 90 726V728C92.7614 728 95 725.761 95 723H93ZM93 708V723H95V708H93ZM89.8303 701.622C91.7581 703.085 93 705.397 93 708H95C95 704.745 93.4439 701.853 91.0391 700.029L89.8303 701.622ZM89 692V699.982H91V692H89ZM88 691C88.5523 691 89 691.448 89 692H91C91 690.343 89.6569 689 88 689V691ZM84 691H88V689H84V691ZM91.0391 700.029C91.0199 700.014 91.0088 699.999 91.0035 699.989C90.9988 699.98 91 699.978 91 699.982H89C89 700.659 89.3413 701.251 89.8303 701.622L91.0391 700.029ZM81 698.805C81 698.801 81.002 698.804 80.9939 698.816C80.9845 698.829 80.9655 698.847 80.9365 698.86L81.7499 700.687C82.4559 700.373 83 699.668 83 698.805H81Z\" fill=\"currentColor\"></path>"],
  "caret-down": ["98.94 184.00 20.13 17.83", "<path d=\"M107.268 199C108.037 200.333 109.963 200.333 110.732 199L116.794 188.5C117.564 187.167 116.602 185.5 115.062 185.5H102.938C101.398 185.5 100.436 187.167 101.206 188.5L107.268 199Z\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"2\"></path>"],
  "carrot": ["112.56 602.33 47.61 48.46", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M153.697 608.717C154.083 609.112 154.083 609.754 153.697 610.15L147.21 616.813L149.561 619.228L156.967 613.469C157.401 613.131 158.02 613.219 158.349 613.665C158.678 614.111 158.592 614.747 158.158 615.084L150.969 620.674L151.984 621.717C153.779 623.56 153.438 626.638 151.286 628.02L121.722 647.005C118.173 649.285 114.065 645.066 116.284 641.42L134.768 611.054C136.114 608.844 139.11 608.494 140.905 610.337L142.278 611.747L147.72 604.363C148.049 603.917 148.668 603.829 149.102 604.167C149.537 604.505 149.622 605.14 149.293 605.587L143.686 613.194L145.815 615.38L152.302 608.717C152.688 608.321 153.312 608.321 153.697 608.717ZM139.509 611.77L150.589 623.15C151.486 624.072 151.316 625.611 150.24 626.302L141.427 631.961C141.45 631.853 141.455 631.739 141.439 631.623L140.113 621.712C140.04 621.164 139.537 620.783 138.99 620.86C138.443 620.937 138.059 621.444 138.133 621.991L139.459 631.903C139.516 632.324 139.827 632.648 140.217 632.738L134.867 636.174L134.338 632.222C134.264 631.667 133.766 631.28 133.227 631.356C132.687 631.432 132.309 631.943 132.384 632.498L133.033 637.352L120.676 645.287C118.901 646.427 116.848 644.317 117.957 642.494L136.441 612.129C137.114 611.024 138.612 610.849 139.509 611.77Z\" fill=\"currentColor\"></path>"],
  "cart": ["302.52 748.67 25.67 25.83", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M326.486 751.671C326.691 751.158 326.441 750.577 325.928 750.371C325.416 750.166 324.834 750.416 324.629 750.928L323.174 754.565C322.657 754.123 321.983 753.85 321.228 753.85H307.506C305.465 753.85 304.02 755.844 304.655 757.784L306.619 763.784C307.023 765.016 308.173 765.85 309.47 765.85H319.264C320.561 765.85 321.711 765.016 322.115 763.784L324.079 757.784C324.188 757.451 324.236 757.116 324.23 756.79C324.404 756.682 324.546 756.519 324.629 756.314L326.486 751.671ZM307.506 755.85H321.228C321.909 755.85 322.39 756.515 322.179 757.161L320.214 763.161C320.08 763.572 319.696 763.85 319.264 763.85H309.47C309.038 763.85 308.654 763.572 308.52 763.161L306.556 757.161C306.344 756.515 306.826 755.85 307.506 755.85ZM312 769.5C312 770.328 311.328 771 310.5 771C309.672 771 309 770.328 309 769.5C309 768.672 309.672 768 310.5 768C311.328 768 312 768.672 312 769.5ZM314 769.5C314 771.433 312.433 773 310.5 773C308.567 773 307 771.433 307 769.5C307 767.567 308.567 766 310.5 766C312.433 766 314 767.567 314 769.5ZM318.5 771C319.328 771 320 770.328 320 769.5C320 768.672 319.328 768 318.5 768C317.672 768 317 768.672 317 769.5C317 770.328 317.672 771 318.5 771ZM318.5 773C320.433 773 322 771.433 322 769.5C322 767.567 320.433 766 318.5 766C316.567 766 315 767.567 315 769.5C315 771.433 316.567 773 318.5 773Z\" fill=\"currentColor\"></path>"],
  "check": ["297.01 292.50 18.08 14.30", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M304.927 304.073C304.967 304.372 304.873 304.685 304.643 304.915C304.253 305.305 303.619 305.305 303.229 304.915L298.898 300.583C298.507 300.193 298.507 299.56 298.898 299.169C299.288 298.779 299.921 298.779 300.312 299.169L303.657 302.514L311.778 294.393C312.169 294.003 312.802 294.003 313.192 294.393C313.583 294.784 313.583 295.417 313.192 295.808L304.927 304.073Z\" fill=\"currentColor\"></path>"],
  "check-circle": ["223.50 588.50 48.00 48.00", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M268 612.5C268 623.822 258.822 633 247.5 633C236.178 633 227 623.822 227 612.5C227 601.178 236.178 592 247.5 592C258.822 592 268 601.178 268 612.5ZM270 612.5C270 624.926 259.926 635 247.5 635C235.074 635 225 624.926 225 612.5C225 600.074 235.074 590 247.5 590C259.926 590 270 600.074 270 612.5ZM246.643 617.915C246.873 617.685 246.967 617.372 246.927 617.073L255.192 608.808C255.583 608.417 255.583 607.784 255.192 607.393C254.802 607.003 254.169 607.003 253.778 607.393L245.657 615.514L242.312 612.169C241.921 611.779 241.288 611.779 240.898 612.169C240.507 612.56 240.507 613.193 240.898 613.583L245.229 617.915C245.619 618.305 246.253 618.305 246.643 617.915Z\" fill=\"currentColor\"></path>"],
  "check-circle-sm": ["298.50 251.00 33.00 33.00", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M315 280.5C322.18 280.5 328 274.68 328 267.5C328 260.32 322.18 254.5 315 254.5C307.82 254.5 302 260.32 302 267.5C302 274.68 307.82 280.5 315 280.5ZM315 282.5C323.284 282.5 330 275.784 330 267.5C330 259.216 323.284 252.5 315 252.5C306.716 252.5 300 259.216 300 267.5C300 275.784 306.716 282.5 315 282.5ZM313.815 271.185C313.77 271.267 313.713 271.345 313.643 271.415C313.253 271.805 312.62 271.805 312.229 271.415L307.898 267.083C307.507 266.693 307.507 266.06 307.898 265.669C308.288 265.279 308.922 265.279 309.312 265.669L312.907 269.264L320.778 261.393C321.169 261.003 321.802 261.003 322.192 261.393C322.583 261.784 322.583 262.417 322.192 262.808L313.815 271.185Z\" fill=\"currentColor\"></path>"],
  "chef-hat": ["218.24 748.46 26.07 24.04", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M234.599 755.856L233.929 754.473C233.764 754.133 233.54 753.812 233.253 753.525C231.886 752.158 229.67 752.158 228.303 753.525C228.034 753.794 227.82 754.093 227.659 754.41L227.091 755.523L225.841 755.501C224.921 755.484 224.003 755.825 223.303 756.525C221.936 757.892 221.936 760.108 223.303 761.475C223.522 761.694 223.76 761.876 224.011 762.023L225 762.602V763.748V769H229H233H237V764.033V762.729L238.193 762.203C238.575 762.034 238.935 761.793 239.253 761.475C240.62 760.108 240.62 757.892 239.253 756.525C238.4 755.672 237.217 755.35 236.108 755.564L234.599 755.856ZM233 769C232.448 769 232 768.552 232 768V764C232 763.448 232.448 763 233 763C233.552 763 234 763.448 234 764V768C234 768.552 233.552 769 233 769ZM229 769C228.448 769 228 768.552 228 768V764C228 763.448 228.448 763 229 763C229.552 763 230 763.448 230 764V768C230 768.552 229.552 769 229 769ZM239 764.033C239.605 763.766 240.172 763.385 240.667 762.889C242.815 760.741 242.815 757.259 240.667 755.111C239.325 753.769 237.462 753.265 235.729 753.6C235.468 753.062 235.114 752.558 234.667 752.111C232.519 749.963 229.037 749.963 226.889 752.111C226.47 752.53 226.133 753 225.877 753.501C224.437 753.475 222.988 754.012 221.889 755.111C219.741 757.259 219.741 760.741 221.889 762.889C222.229 763.229 222.603 763.516 223 763.748V769C223 770.105 223.895 771 225 771H237C238.104 771 239 770.105 239 769V764.033Z\" fill=\"currentColor\"></path>"],
  "cherries": ["68.19 526.56 34.31 36.94", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M69.6919 529.062C69.6919 528.509 70.1396 528.062 70.6919 528.062C83.7491 528.062 94.6771 536.821 95.204 548.103C98.4963 548.674 101 551.545 101 555C101 558.866 97.866 562 94 562C90.134 562 87 558.866 87 555C87 551.405 89.7096 548.443 93.1978 548.045C92.6849 539.085 84.6492 531.582 74.0286 530.266C74.7781 531.377 75.4199 532.864 75.9496 534.596C77.024 538.11 77.6978 542.837 77.7688 548.042C81.2731 548.425 84 551.394 84 555C84 558.866 80.866 562 77 562C73.134 562 70 558.866 70 555C70 551.554 72.4903 548.689 75.7695 548.108C75.7032 543.026 75.0457 538.48 74.037 535.181C73.5028 533.434 72.887 532.093 72.2493 531.211C71.595 530.306 71.0557 530.062 70.6919 530.062C70.1396 530.062 69.6919 529.614 69.6919 529.062ZM72 555C72 552.239 74.2386 550 77 550C79.7614 550 82 552.239 82 555C82 557.761 79.7614 560 77 560C74.2386 560 72 557.761 72 555ZM89 555C89 552.239 91.2386 550 94 550C96.7614 550 99 552.239 99 555C99 557.761 96.7614 560 94 560C91.2386 560 89 557.761 89 555Z\" fill=\"currentColor\"></path>"],
  "chevron-right": ["312.33 124.33 11.27 15.92", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M320.531 133.469C320.909 133.67 321.389 133.611 321.707 133.293C322.098 132.902 322.098 132.269 321.707 131.879L321.545 131.717C321.499 131.561 321.415 131.415 321.293 131.293C321.171 131.171 321.024 131.086 320.869 131.041L316.05 126.222C315.66 125.831 315.027 125.831 314.636 126.222C314.246 126.612 314.246 127.246 314.636 127.636L319.086 132.086L314.222 136.95C313.831 137.34 313.831 137.973 314.222 138.364C314.612 138.754 315.246 138.754 315.636 138.364L320.531 133.469Z\" fill=\"currentColor\"></path>"],
  "cocktail": ["170.33 690.32 36.32 37.47", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M202.907 704.587C204.023 703.441 204.74 701.948 204.946 700.34C205.152 698.731 204.836 697.095 204.044 695.685C203.251 694.275 202.027 693.171 200.56 692.547C199.093 691.923 197.469 691.815 195.94 692.236C194.412 692.656 193.063 693.583 192.103 694.869C191.142 696.155 190.621 697.731 190.621 699.354L191.624 699.366L173.154 699.366C172.275 699.366 171.834 700.457 172.456 701.096L185.126 714.109V724.285H182.631C182.079 724.285 181.631 724.733 181.631 725.285C181.631 725.837 182.079 726.285 182.631 726.285H186.126H189.62C190.172 726.285 190.62 725.837 190.62 725.285C190.62 724.733 190.172 724.285 189.62 724.285H187.126V714.107L194.908 706.113C196.115 706.662 197.449 706.862 198.765 706.684C200.335 706.472 201.791 705.734 202.907 704.587ZM196.439 704.541L199.793 701.096C200.415 700.457 199.975 699.366 199.096 699.366H192.601C192.603 698.188 192.983 697.041 193.682 696.105C194.384 695.165 195.367 694.492 196.477 694.186C197.586 693.881 198.759 693.961 199.816 694.41C200.873 694.86 201.756 695.655 202.329 696.675C202.902 697.694 203.133 698.882 202.983 700.055C202.833 701.228 202.309 702.318 201.494 703.155C200.679 703.992 199.62 704.528 198.483 704.682C197.794 704.775 197.1 704.725 196.439 704.541ZM175.535 701.392L185.454 711.58C185.632 711.419 185.867 711.321 186.126 711.321C186.384 711.321 186.619 711.419 186.796 711.579L196.714 701.392L175.535 701.392Z\" fill=\"currentColor\"></path>"],
  "drumstick": ["272.59 524.60 39.28 39.99", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M279.722 531.882C283.189 528.32 288.811 528.32 292.278 531.882C294.042 533.693 294.908 536.075 294.878 538.451C294.858 540.005 295.223 541.77 296.457 543.038L298.673 545.315C299.829 546.502 299.829 548.426 298.673 549.614L296.581 551.763C295.425 552.95 293.551 552.95 292.395 551.763L289.786 549.083C288.639 547.906 287.068 547.498 285.659 547.443C283.5 547.358 281.369 546.471 279.722 544.779C276.254 541.217 276.254 535.443 279.722 531.882ZM293.673 530.449C289.436 526.096 282.564 526.096 278.327 530.449C274.089 534.801 274.089 541.859 278.327 546.212C280.339 548.279 282.948 549.365 285.584 549.468C286.727 549.513 287.731 549.839 288.391 550.516L291 553.196C292.591 554.83 294.997 555.115 296.873 554.05L299.097 556.335C297.924 557.882 298.03 560.12 299.414 561.542C300.913 563.082 303.343 563.082 304.842 561.542C305.642 560.72 306.015 559.626 305.961 558.55C307.009 558.605 308.074 558.222 308.874 557.4C310.373 555.861 310.373 553.365 308.874 551.825C307.49 550.403 305.311 550.295 303.805 551.5L301.303 548.93C301.811 547.201 301.399 545.248 300.069 543.882L297.852 541.605C297.142 540.876 296.835 539.746 296.851 538.478C296.888 535.578 295.829 532.662 293.673 530.449ZM300.312 550.778C300.235 550.87 300.153 550.959 300.069 551.047L298.404 552.757L300.84 555.259C301.49 555.927 301.302 556.894 300.809 557.4C300.081 558.148 300.081 559.361 300.809 560.109C301.538 560.857 302.718 560.857 303.447 560.109C304.175 559.361 304.175 558.148 303.447 557.4C303.416 557.369 303.384 557.338 303.352 557.309C302.92 556.922 302.895 556.238 303.303 555.819C303.711 555.4 304.376 555.426 304.753 555.87C304.782 555.903 304.811 555.936 304.842 555.967C305.57 556.715 306.751 556.715 307.479 555.967C308.208 555.219 308.208 554.006 307.479 553.258C306.751 552.51 305.57 552.51 304.842 553.258C304.349 553.764 303.407 553.957 302.757 553.289L300.312 550.778Z\" fill=\"currentColor\"></path>"],
  "heart": ["284.05 524.05 29.69 26.06", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M289.889 530.111C287.741 532.259 287.741 535.741 289.889 537.889L298.021 546.021C298.411 546.411 299.045 546.411 299.435 546.021L299.445 546.011C299.558 545.962 299.665 545.892 299.757 545.799L307.889 537.667C310.037 535.519 310.037 532.037 307.889 529.889C305.741 527.741 302.259 527.741 300.111 529.889L298.778 531.222L297.667 530.111C295.519 527.963 292.037 527.963 289.889 530.111Z\"></path><path d=\"M289.889 537.889L288.475 539.303L289.889 537.889ZM298.021 546.021L299.435 544.607L298.021 546.021ZM299.435 546.021L298.021 544.607L299.435 546.021ZM299.445 546.011L298.656 544.173L298.303 544.325L298.031 544.597L299.445 546.011ZM299.757 545.799L298.343 544.385L298.343 544.385L299.757 545.799ZM307.889 537.667L309.303 539.081V539.081L307.889 537.667ZM300.111 529.889L298.697 528.475V528.475L300.111 529.889ZM298.778 531.222L297.364 532.636L298.778 534.05L300.192 532.636L298.778 531.222ZM297.667 530.111L299.081 528.697L297.667 530.111ZM291.303 536.475C289.936 535.108 289.936 532.892 291.303 531.525L288.475 528.697C285.546 531.626 285.546 536.374 288.475 539.303L291.303 536.475ZM299.435 544.607L291.303 536.475L288.475 539.303L296.607 547.435L299.435 544.607ZM298.021 544.607C298.411 544.216 299.045 544.216 299.435 544.607L296.607 547.435C297.778 548.607 299.678 548.607 300.849 547.435L298.021 544.607ZM298.031 544.597L298.021 544.607L300.849 547.435L300.859 547.425L298.031 544.597ZM298.343 544.385C298.433 544.295 298.54 544.223 298.656 544.173L300.233 547.849C300.576 547.702 300.896 547.489 301.172 547.213L298.343 544.385ZM306.475 536.253L298.343 544.385L301.172 547.213L309.303 539.081L306.475 536.253ZM306.475 531.303C307.842 532.67 307.842 534.886 306.475 536.253L309.303 539.081C312.232 536.153 312.232 531.404 309.303 528.475L306.475 531.303ZM301.525 531.303C302.892 529.936 305.108 529.936 306.475 531.303L309.303 528.475C306.374 525.546 301.626 525.546 298.697 528.475L301.525 531.303ZM300.192 532.636L301.525 531.303L298.697 528.475L297.364 529.808L300.192 532.636ZM296.253 531.525L297.364 532.636L300.192 529.808L299.081 528.697L296.253 531.525ZM291.303 531.525C292.67 530.158 294.886 530.158 296.253 531.525L299.081 528.697C296.153 525.768 291.404 525.768 288.475 528.697L291.303 531.525Z\" fill=\"currentColor\" mask=\"url(#path-19-inside-1_82_604)\"></path>"],
  "heart-filled": ["263.05 286.05 29.69 26.06", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M268.889 292.111C266.741 294.259 266.741 297.741 268.889 299.889L277.021 308.021C277.411 308.411 278.045 308.411 278.435 308.021L278.445 308.011C278.558 307.962 278.665 307.892 278.757 307.799L286.889 299.667C289.037 297.519 289.037 294.037 286.889 291.889C284.741 289.741 281.259 289.741 279.111 291.889L277.778 293.222L276.667 292.111C274.519 289.963 271.037 289.963 268.889 292.111Z\"></path><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M268.889 292.111C266.741 294.259 266.741 297.741 268.889 299.889L277.021 308.021C277.411 308.411 278.045 308.411 278.435 308.021L278.445 308.011C278.558 307.962 278.665 307.892 278.757 307.799L286.889 299.667C289.037 297.519 289.037 294.037 286.889 291.889C284.741 289.741 281.259 289.741 279.111 291.889L277.778 293.222L276.667 292.111C274.519 289.963 271.037 289.963 268.889 292.111Z\" fill=\"currentColor\"></path><path d=\"M268.889 299.889L267.475 301.303L268.889 299.889ZM277.021 308.021L278.435 306.607L277.021 308.021ZM278.445 308.011L277.656 306.173L277.303 306.325L277.031 306.597L278.445 308.011ZM278.757 307.799L277.343 306.385L277.343 306.385L278.757 307.799ZM286.889 299.667L288.303 301.081V301.081L286.889 299.667ZM279.111 291.889L277.697 290.475V290.475L279.111 291.889ZM277.778 293.222L276.364 294.636L277.778 296.05L279.192 294.636L277.778 293.222ZM276.667 292.111L278.081 290.697L276.667 292.111ZM270.303 298.475C268.936 297.108 268.936 294.892 270.303 293.525L267.475 290.697C264.546 293.626 264.546 298.374 267.475 301.303L270.303 298.475ZM278.435 306.607L270.303 298.475L267.475 301.303L275.607 309.435L278.435 306.607ZM277.021 306.607C277.411 306.216 278.045 306.216 278.435 306.607L275.607 309.435C276.778 310.607 278.678 310.607 279.849 309.435L277.021 306.607ZM277.031 306.597L277.021 306.607L279.849 309.435L279.859 309.425L277.031 306.597ZM277.343 306.385C277.433 306.295 277.54 306.223 277.656 306.173L279.233 309.849C279.576 309.702 279.896 309.489 280.172 309.213L277.343 306.385ZM285.475 298.253L277.343 306.385L280.172 309.213L288.303 301.081L285.475 298.253ZM285.475 293.303C286.842 294.67 286.842 296.886 285.475 298.253L288.303 301.081C291.232 298.153 291.232 293.404 288.303 290.475L285.475 293.303ZM280.525 293.303C281.892 291.936 284.108 291.936 285.475 293.303L288.303 290.475C285.374 287.546 280.626 287.546 277.697 290.475L280.525 293.303ZM279.192 294.636L280.525 293.303L277.697 290.475L276.364 291.808L279.192 294.636ZM275.253 293.525L276.364 294.636L279.192 291.808L278.081 290.697L275.253 293.525ZM270.303 293.525C271.67 292.158 273.886 292.158 275.253 293.525L278.081 290.697C275.153 287.768 270.404 287.768 267.475 290.697L270.303 293.525Z\" fill=\"currentColor\" mask=\"url(#path-15-inside-2_76_1499)\"></path>"],
  "home": ["48.50 749.13 23.00 23.84", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M68 760.739V767.465C68 768.569 67.1046 769.465 66 769.465H63.4649C63.8052 768.876 64 768.193 64 767.465V765.735C64 764.567 63.4902 763.458 62.6042 762.699C61.1059 761.413 58.8941 761.413 57.3958 762.699C56.5098 763.458 56 764.567 56 765.735V767.465C56 768.193 56.1948 768.876 56.5351 769.465H54C52.8954 769.465 52 768.569 52 767.465V760.739C52 760.193 52.2231 759.671 52.6176 759.294L58.6176 753.555C59.3908 752.815 60.6092 752.815 61.3824 753.555L67.3824 759.294C67.7769 759.671 68 760.193 68 760.739ZM59.9773 769.465C58.8832 769.452 58 768.562 58 767.465V765.735C58 765.151 58.2549 764.597 58.6979 764.217C59.447 763.574 60.553 763.574 61.3021 764.217C61.7451 764.597 62 765.151 62 765.735V767.465C62 768.562 61.1168 769.452 60.0227 769.465H59.9773ZM59.9679 771.465H54C51.7909 771.465 50 769.674 50 767.465V760.739C50 759.647 50.4462 758.603 51.2351 757.848L57.2351 752.109C58.7816 750.63 61.2184 750.63 62.7649 752.109L68.7649 757.848C69.5538 758.603 70 759.647 70 760.739V767.465C70 769.674 68.2091 771.465 66 771.465H60.0321C60.0214 771.465 60.0107 771.465 60 771.465C59.9893 771.465 59.9786 771.465 59.9679 771.465Z\" fill=\"currentColor\"></path>"],
  "jar": ["226.03 605.28 29.47 41.44", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M230.116 613.469C229.991 613.234 229.778 613.06 229.526 612.983C229.575 610.653 231.478 608.78 233.819 608.78H247.413C249.4 608.78 251.075 610.132 251.562 611.967C251.6 612.11 251.67 612.243 251.765 612.356C251.912 612.53 252 612.754 252 613C252 613.552 251.552 614 251 614C250.622 614 250.292 613.791 250.121 613.477C249.946 613.156 249.609 612.956 249.243 612.956H248.757C248.391 612.956 248.054 613.156 247.879 613.477C247.708 613.791 247.378 614 247 614C246.622 614 246.292 613.791 246.121 613.477C245.946 613.156 245.609 612.956 245.243 612.956H244.757C244.391 612.956 244.054 613.156 243.879 613.477C243.708 613.791 243.378 614 243 614C242.622 614 242.292 613.791 242.121 613.477C241.946 613.156 241.609 612.956 241.243 612.956H240.757C240.391 612.956 240.054 613.156 239.879 613.477C239.708 613.791 239.378 614 239 614C238.622 614 238.292 613.791 238.121 613.477C237.946 613.156 237.609 612.956 237.243 612.956H236.757C236.391 612.956 236.054 613.156 235.879 613.477C235.708 613.791 235.378 614 235 614C234.622 614 234.292 613.791 234.121 613.477C233.946 613.156 233.609 612.956 233.243 612.956H232.757C232.391 612.956 232.054 613.156 231.879 613.477C231.708 613.791 231.378 614 231 614C230.619 614 230.286 613.787 230.116 613.469ZM233.819 606.78C230.343 606.78 227.525 609.598 227.525 613.074C227.525 613.813 227.951 614.451 228.57 614.76C228.659 614.882 228.757 614.997 228.862 615.105C228.032 616.46 227.525 618.225 227.525 620.309V636.08C227.525 641.102 231.495 645.218 236.448 645.218H244.783C249.521 645.218 253.359 641.452 253.684 636.73C253.878 636.547 254 636.288 254 636V622C254 621.723 253.888 621.473 253.706 621.292V620.309C253.706 618.437 253.297 616.822 252.612 615.531C253.446 614.998 254 614.064 254 613C254 612.348 253.791 611.744 253.438 611.252C252.657 608.665 250.256 606.78 247.413 606.78H233.819ZM250.563 615.968C249.967 615.881 249.428 615.619 249 615.236C248.47 615.71 247.769 616 247 616C246.231 616 245.53 615.71 245 615.236C244.47 615.71 243.769 616 243 616C242.231 616 241.53 615.71 241 615.236C240.47 615.71 239.769 616 239 616C238.231 616 237.53 615.71 237 615.236C236.47 615.71 235.769 616 235 616C234.231 616 233.53 615.71 233 615.236C232.47 615.71 231.769 616 231 616C230.886 616 230.773 615.994 230.662 615.981C230.644 616.022 230.622 616.062 230.598 616.101C229.967 617.108 229.525 618.519 229.525 620.309V621H251.706V620.309C251.706 618.519 251.264 617.108 250.633 616.101C250.606 616.058 250.583 616.013 250.563 615.968ZM236.448 643.218C232.948 643.218 230.02 640.527 229.582 637H251.649C251.21 640.527 248.283 643.218 244.783 643.218H236.448ZM251.706 635V623H230V635H251.706Z\" fill=\"currentColor\"></path>"],
  "message-x": ["74.00 524.50 28.20 24.38", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M79.5 528H96.7C97.8046 528 98.7 528.895 98.7 530V539.143C98.7 540.247 97.8046 541.143 96.7 541.143H94.814C92.8085 541.143 90.9355 542.145 89.8226 543.813L89.7638 543.902C88.9721 545.088 87.2279 545.088 86.4362 543.902L86.3774 543.813C85.2645 542.145 83.3915 541.143 81.386 541.143H79.5C78.3954 541.143 77.5 540.247 77.5 539.143V530C77.5 528.895 78.3954 528 79.5 528ZM75.5 530C75.5 527.791 77.2909 526 79.5 526H96.7C98.9091 526 100.7 527.791 100.7 530V539.143C100.7 541.352 98.9091 543.143 96.7 543.143H94.814C93.477 543.143 92.2284 543.811 91.4864 544.923L91.4276 545.011C89.8442 547.385 86.3558 547.385 84.7724 545.011L84.7136 544.923C83.9716 543.811 82.723 543.143 81.386 543.143H79.5C77.2909 543.143 75.5 541.352 75.5 539.143V530ZM91.2929 532.293C91.6834 532.683 91.6834 533.317 91.2929 533.707L90 535L90.9497 535.95C91.3403 536.34 91.3403 536.973 90.9497 537.364C90.5592 537.754 89.9261 537.754 89.5355 537.364L88.5858 536.414L87.0503 537.95C86.6597 538.34 86.0266 538.34 85.636 537.95C85.2455 537.559 85.2455 536.926 85.636 536.536L87.1716 535L85.2929 533.121C84.9024 532.731 84.9024 532.098 85.2929 531.707C85.6834 531.317 86.3166 531.317 86.7071 531.707L88.5858 533.586L89.8787 532.293C90.2692 531.902 90.9024 531.902 91.2929 532.293Z\" fill=\"currentColor\"></path>"],
  "note-edit": ["134.50 749.50 25.02 23.00", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M138 756C138 754.343 139.343 753 141 753H149C150.657 753 152 754.343 152 756V757.204L149.802 759.402C149.619 759.158 149.328 759 149 759H141C140.448 759 140 759.448 140 760C140 760.552 140.448 761 141 761H148.204L146.186 763.017C146.126 763.006 146.064 763 146 763H141C140.448 763 140 763.448 140 764C140 764.552 140.448 765 141 765H145L144.774 765.952C144.479 767.195 145.397 768.331 146.579 768.411C146.774 768.424 146.977 768.408 147.182 768.359L148.626 768.017C148.986 767.931 149.316 767.747 149.578 767.485L152 765.063V766C152 767.657 150.657 769 149 769H141C139.343 769 138 767.657 138 766V756ZM154 763.063V766C154 768.761 151.761 771 149 771H141C138.239 771 136 768.761 136 766V756C136 753.239 138.239 751 141 751H149C151.577 751 153.699 752.95 153.971 755.455C154.693 755.162 155.552 755.308 156.138 755.894L157.239 756.996C158.02 757.777 158.02 759.043 157.239 759.824L154 763.063ZM146.72 766.413L148.164 766.071L155.825 758.41L154.724 757.308L153.722 758.31C153.717 758.315 153.712 758.32 153.707 758.325L147.063 764.97L146.72 766.413ZM140 756C140 755.448 140.448 755 141 755H149C149.552 755 150 755.448 150 756C150 756.552 149.552 757 149 757H141C140.448 757 140 756.552 140 756Z\" fill=\"currentColor\"></path>"],
  "plus": ["98.50 348.50 19.00 19.00", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M107 365C107 365.552 107.448 366 108 366C108.552 366 109 365.552 109 365V359H115C115.552 359 116 358.552 116 358C116 357.448 115.552 357 115 357L109 357L109 351C109 350.448 108.552 350 108 350C107.448 350 107 350.448 107 351L107 357L101 357C100.448 357 100 357.448 100 358C100 358.552 100.448 359 101 359L107 359L107 365Z\" fill=\"currentColor\"></path>"],
  "refresh": ["80.74 169.95 31.49 26.10", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M96.8454 171.452C93.7828 171.452 90.8455 172.669 88.6799 174.834C86.9381 176.576 85.8102 178.817 85.4354 181.221L83.9303 180.215C83.4711 179.908 82.8501 180.032 82.5432 180.491C82.2363 180.95 82.3598 181.571 82.819 181.878L85.742 183.831C86.0707 184.051 86.4979 184.056 86.8321 183.845L89.9214 181.892C90.3882 181.597 90.5274 180.979 90.2322 180.512C89.9371 180.045 89.3194 179.906 88.8526 180.201L87.4971 181.058C87.8727 179.25 88.7683 177.574 90.0941 176.249C91.8847 174.458 94.3132 173.452 96.8454 173.452C99.3777 173.452 101.806 174.458 103.597 176.249C103.987 176.639 104.62 176.639 105.011 176.249C105.401 175.858 105.401 175.225 105.011 174.834C102.845 172.669 99.9081 171.452 96.8454 171.452ZM96.393 194.548C99.4557 194.548 102.393 193.331 104.559 191.166C106.199 189.525 107.295 187.442 107.73 185.196L108.92 186.38C109.311 186.77 109.945 186.768 110.334 186.377C110.724 185.985 110.722 185.352 110.331 184.963L107.646 182.291C107.359 182.005 106.928 181.921 106.554 182.078L103.464 183.374C102.955 183.588 102.716 184.174 102.929 184.684C103.143 185.193 103.729 185.432 104.238 185.219L105.813 184.558C105.49 186.512 104.563 188.332 103.144 189.751C101.354 191.542 98.9252 192.548 96.393 192.548C93.8608 192.548 91.4323 191.542 89.6417 189.751C89.2512 189.361 88.618 189.361 88.2275 189.751C87.837 190.142 87.837 190.775 88.2275 191.166C90.3931 193.331 93.3303 194.548 96.393 194.548Z\" fill=\"currentColor\"></path>"],
  "shift": ["16.80 649.10 26.93 25.64", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M39.5275 661.941C40.4486 661.941 40.8799 660.801 40.1894 660.192L30.9266 652.013C30.5485 651.679 29.981 651.679 29.6028 652.013L20.3401 660.192C19.6496 660.801 20.0809 661.941 21.002 661.941H22.6334C23.1856 661.941 23.6334 662.389 23.6334 662.941V671.238C23.6334 671.79 24.0811 672.238 24.6334 672.238H35.8961C36.4484 672.238 36.8961 671.79 36.8961 671.238V662.941C36.8961 662.389 37.3438 661.941 37.8961 661.941H39.5275Z\" fill=\"#D0D8E2\"></path><path d=\"M40.1894 660.192L40.8513 659.442L40.1894 660.192ZM30.9266 652.013L30.2647 652.762L30.9266 652.013ZM29.6028 652.013L28.9409 651.263L29.6028 652.013ZM30.2647 652.762L39.5275 660.941L40.8513 659.442L31.5885 651.263L30.2647 652.762ZM21.002 660.941L30.2647 652.762L28.9409 651.263L19.6782 659.442L21.002 660.941ZM22.6334 660.941H21.002V662.941H22.6334V660.941ZM24.6334 671.238V662.941H22.6334V671.238H24.6334ZM35.8961 671.238H24.6334V673.238H35.8961V671.238ZM35.8961 662.941V671.238H37.8961V662.941H35.8961ZM39.5275 660.941H37.8961V662.941H39.5275V660.941ZM37.8961 662.941H37.8961V660.941C36.7915 660.941 35.8961 661.837 35.8961 662.941H37.8961ZM35.8961 673.238C37.0006 673.238 37.8961 672.342 37.8961 671.238H35.8961V671.238V673.238ZM22.6334 671.238C22.6334 672.342 23.5288 673.238 24.6334 673.238V671.238H24.6334H22.6334ZM22.6334 662.941V662.941H24.6334C24.6334 661.837 23.7379 660.941 22.6334 660.941V662.941ZM19.6782 659.442C18.2973 660.662 19.1597 662.941 21.002 662.941V660.941H21.002L19.6782 659.442ZM39.5275 660.941V660.941V662.941C41.3697 662.941 42.2322 660.662 40.8513 659.442L39.5275 660.941ZM31.5885 651.263C30.8323 650.595 29.6972 650.595 28.9409 651.263L30.2647 652.762V652.762L31.5885 651.263Z\" fill=\"currentColor\"></path>"],
  "venn": ["62.50 527.50 36.00 27.00", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M76 531C70.4772 531 66 535.477 66 541C66 546.523 70.4772 551 76 551C77.6186 551 79.1474 550.615 80.5 549.933C81.8526 550.615 83.3814 551 85 551C90.5228 551 95 546.523 95 541C95 535.477 90.5228 531 85 531C83.3814 531 81.8526 531.385 80.5 532.067C79.1474 531.385 77.6186 531 76 531ZM80.5 532.067C77.2374 533.714 75 537.096 75 541C75 544.904 77.2374 548.286 80.5 549.933C83.7626 548.286 86 544.904 86 541C86 537.096 83.7626 533.714 80.5 532.067Z\"></path><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M76 531C70.4772 531 66 535.477 66 541C66 546.523 70.4772 551 76 551C77.6186 551 79.1474 550.615 80.5 549.933C81.8526 550.615 83.3814 551 85 551C90.5228 551 95 546.523 95 541C95 535.477 90.5228 531 85 531C83.3814 531 81.8526 531.385 80.5 532.067C79.1474 531.385 77.6186 531 76 531ZM80.5 532.067C77.2374 533.714 75 537.096 75 541C75 544.904 77.2374 548.286 80.5 549.933C83.7626 548.286 86 544.904 86 541C86 537.096 83.7626 533.714 80.5 532.067Z\" fill=\"currentColor\"></path><path d=\"M68 541C68 536.582 71.5817 533 76 533V529C69.3726 529 64 534.373 64 541H68ZM76 549C71.5817 549 68 545.418 68 541H64C64 547.627 69.3726 553 76 553V549ZM79.5988 548.147C78.5193 548.692 77.2985 549 76 549V553C77.9387 553 79.7755 552.539 81.4012 551.718L79.5988 548.147ZM85 549C83.7015 549 82.4807 548.692 81.4012 548.147L79.5988 551.718C81.2245 552.539 83.0613 553 85 553V549ZM93 541C93 545.418 89.4183 549 85 549V553C91.6274 553 97 547.627 97 541H93ZM85 533C89.4183 533 93 536.582 93 541H97C97 534.373 91.6274 529 85 529V533ZM81.4012 533.853C82.4807 533.308 83.7015 533 85 533V529C83.0613 529 81.2245 529.461 79.5988 530.282L81.4012 533.853ZM76 533C77.2985 533 78.5193 533.308 79.5988 533.853L81.4012 530.282C79.7755 529.461 77.9387 529 76 529V533ZM77 541C77 537.88 78.7862 535.173 81.4012 533.853L79.5988 530.282C75.6886 532.256 73 536.312 73 541H77ZM81.4012 548.147C78.7862 546.827 77 544.12 77 541H73C73 545.688 75.6886 549.744 79.5988 551.718L81.4012 548.147ZM84 541C84 544.12 82.2138 546.827 79.5988 548.147L81.4012 551.718C85.3114 549.744 88 545.688 88 541H84ZM79.5988 533.853C82.2138 535.173 84 537.88 84 541H88C88 536.312 85.3114 532.256 81.4012 530.282L79.5988 533.853Z\" fill=\"currentColor\" mask=\"url(#path-70-inside-1_82_1401)\"></path>"],
  "x-circle": ["103.50 588.50 48.00 48.00", "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M148 612.5C148 623.822 138.822 633 127.5 633C116.178 633 107 623.822 107 612.5C107 601.178 116.178 592 127.5 592C138.822 592 148 601.178 148 612.5ZM150 612.5C150 624.926 139.926 635 127.5 635C115.074 635 105 624.926 105 612.5C105 600.074 115.074 590 127.5 590C139.926 590 150 600.074 150 612.5ZM132.707 618.293C133.098 617.902 133.098 617.269 132.707 616.879L128.914 613.086L132.899 609.101C133.29 608.71 133.29 608.077 132.899 607.686C132.509 607.296 131.876 607.296 131.485 607.686L127.5 611.672L123.515 607.686C123.124 607.296 122.491 607.296 122.101 607.686C121.71 608.077 121.71 608.71 122.101 609.101L126.086 613.086L122.293 616.879C121.902 617.269 121.902 617.902 122.293 618.293C122.683 618.683 123.317 618.683 123.707 618.293L127.5 614.5L131.293 618.293C131.683 618.683 132.317 618.683 132.707 618.293Z\" fill=\"currentColor\"></path>"]
};
const glyphNames = Object.keys(glyphs);
function Icon({
  name,
  size = 24,
  color = "currentColor",
  strokeWidth,
  style,
  className,
  title,
  ...rest
}) {
  const g = glyphs[name];
  if (!g) return null;
  const [viewBox, body] = g;
  return /*#__PURE__*/React.createElement("svg", _extends({
    role: title ? "img" : "presentation",
    "aria-hidden": title ? undefined : true,
    viewBox: viewBox,
    width: size,
    height: size,
    fill: "none",
    className: className,
    style: {
      display: "block",
      flex: "none",
      color,
      strokeWidth,
      overflow: "visible",
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: (title ? `<title>${title}</title>` : "") + body
    }
  }, rest));
}
Object.assign(__ds_scope, { glyphs, glyphNames, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icon/Icon.jsx", error: String((e && e.message) || e) }); }

// components/collections/SelectGrid.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Multi-select grid. Three columns of squircles at radius 19. Unselected cells are opaque
   #D0D8E2; selected cells drop to slate at 15% and show a bare check. */
function SelectGrid({
  count = 12,
  selected = [],
  onToggle,
  columns = 3,
  cell = 108,
  gap = 14,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${columns},1fr)`,
      gap: `${gap}px`,
      ...style
    }
  }, rest), Array.from({
    length: count
  }, (_, i) => {
    const on = selected.includes(i);
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      "aria-pressed": on,
      onClick: onToggle ? () => onToggle(i) : undefined,
      style: {
        height: `${cell}px`,
        borderRadius: "19px",
        border: "2px solid var(--line-soft)",
        background: on ? "var(--slate-a15)" : "var(--fill)",
        display: "grid",
        placeItems: "center",
        padding: 0,
        color: "var(--ink)",
        cursor: onToggle ? "pointer" : "default",
        transition: "var(--transition-state)"
      }
    }, on ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 15
    }) : null);
  }));
}
Object.assign(__ds_scope, { SelectGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/SelectGrid.jsx", error: String((e && e.message) || e) }); }

// components/controls/CheckCircle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Circular checkbox. Unchecked is a bare 2px ring; checked shows the kit's own
   check-circle glyph. Default 26px, the trailing size used in list rows. */
function CheckCircle({
  checked = false,
  size = 26,
  onChange,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "checkbox",
    "aria-checked": checked,
    disabled: disabled,
    onClick: onChange ? () => onChange(!checked) : undefined,
    style: {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      padding: 0,
      flex: "none",
      display: "grid",
      placeItems: "center",
      border: checked ? "none" : "2px solid var(--ink)",
      background: "transparent",
      color: "var(--ink)",
      opacity: disabled ? 0.4 : 1,
      cursor: onChange && !disabled ? "pointer" : "default",
      transition: "var(--transition-state)",
      ...style
    }
  }, rest), checked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check-circle",
    size: size
  }) : null);
}
Object.assign(__ds_scope, { CheckCircle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/CheckCircle.jsx", error: String((e && e.message) || e) }); }

// components/controls/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Circular or squircle icon button. The source uses 36–43px at radius 50% for navigation
   and 26px for row-level actions; the squircle form (radius 19) appears in the dock. */
function IconButton({
  icon,
  size = 40,
  variant = "outline",
  shape = "circle",
  iconSize,
  badge = false,
  onClick,
  label,
  style,
  ...rest
}) {
  const skin = variant === "solid" ? {
    background: "var(--ink)",
    border: "2px solid var(--ink)",
    color: "var(--white)"
  } : variant === "bare" ? {
    background: "transparent",
    border: "2px solid transparent",
    color: "var(--ink)"
  } : {
    background: "transparent",
    border: "2px solid var(--ink)",
    color: "var(--ink)"
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label || icon,
    onClick: onClick,
    style: {
      position: "relative",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: shape === "squircle" ? "19px" : "50%",
      padding: 0,
      flex: "none",
      display: "grid",
      placeItems: "center",
      cursor: onClick ? "pointer" : "default",
      transition: "var(--transition-state)",
      ...skin,
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize || Math.round(size * 0.52)
  }) : null, badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "-1px",
      right: "-1px",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      background: variant === "solid" ? "var(--white)" : "var(--ink)",
      border: "2px solid var(--ink)",
      boxSizing: "content-box"
    }
  }) : null);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/controls/RangeSlider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Range slider. A flat slate track with a rounded capsule marking the selected span and a
   caret-down glyph pinned above each end. */
function RangeSlider({
  from = 0.2,
  to = 0.5,
  h = 22,
  style,
  ...rest
}) {
  const a = Math.max(0, Math.min(1, Math.min(from, to)));
  const b = Math.max(0, Math.min(1, Math.max(from, to)));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      paddingTop: "14px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: `${h}px`,
      borderRadius: `${h / 2}px`,
      background: "var(--fill)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "-1px",
      bottom: "-1px",
      left: `${a * 100}%`,
      width: `${(b - a) * 100}%`,
      borderRadius: `${h / 2}px`,
      border: "2px solid var(--ink)",
      background: "var(--slate-a35)"
    }
  }), [a, b].map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: "absolute",
      top: "-15px",
      left: `${p * 100}%`,
      transform: "translateX(-50%)",
      color: "var(--ink)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "caret-down",
    size: 14
  })))));
}
Object.assign(__ds_scope, { RangeSlider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/RangeSlider.jsx", error: String((e && e.message) || e) }); }

// components/controls/SearchBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Search row: a 48px pill field and a trailing round button. The source shows both an
   outline button (browse screens) and a solid ink one (search screens). */
function SearchBar({
  value,
  onChange,
  placeholder,
  action = "outline",
  icon,
  onAction,
  style,
  ...rest
}) {
  const live = value !== undefined && onChange !== undefined;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: "48px",
      borderRadius: "999px",
      border: "2px solid var(--ink)",
      display: "flex",
      alignItems: "center",
      padding: "0 22px",
      transition: "var(--transition-state)"
    }
  }, live ? /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    style: {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      font: "400 var(--text-md)/1 var(--font-sans)",
      color: "var(--ink)"
    }
  }) : null), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    size: 38,
    variant: action,
    icon: icon,
    onClick: onAction,
    label: "Search"
  }));
}
Object.assign(__ds_scope, { SearchBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/SearchBar.jsx", error: String((e && e.message) || e) }); }

// components/controls/Stepper.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Quantity control: minus, plus, and a reset, each a 26px ring.
   Note: the source has no minus glyph, so the minus is drawn as a 12×2 rule — the same
   weight as every other stroke in the kit. */
function Stepper({
  onDecrement,
  onIncrement,
  onReset,
  size = 26,
  gap = 16,
  reset = true,
  style,
  ...rest
}) {
  const ring = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: "2px solid var(--ink)",
    background: "transparent",
    display: "grid",
    placeItems: "center",
    padding: 0,
    flex: "none",
    color: "var(--ink)",
    cursor: "pointer",
    transition: "var(--transition-state)"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: `${gap}px`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Decrease",
    onClick: onDecrement,
    style: ring
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "12px",
      height: "2px",
      background: "var(--ink)"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Increase",
    onClick: onIncrement,
    style: ring
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "plus",
    size: 13
  })), reset ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Reset",
    onClick: onReset,
    style: ring
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "refresh",
    size: 13
  })) : null);
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/frame/Keyboard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ROWS = [["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], ["A", "S", "D", "F", "G", "H", "J", "K", "L"], ["shift", "Z", "X", "C", "V", "B", "N", "M", "backspace"]];
const key = extra => ({
  height: "38px",
  borderRadius: "9px",
  background: "var(--fill)",
  border: "none",
  display: "grid",
  placeItems: "center",
  font: "400 20px/1 var(--font-sans)",
  color: "var(--ink)",
  cursor: "pointer",
  padding: 0,
  transition: "var(--transition-state)",
  ...extra
});

/* The QWERTY keyboard from screen 211. Keys are #D0D8E2 with 9px corners; the glyphs are
   Space Grotesk outlines in the source, which is why the kit's typeface is Space Grotesk. */
function Keyboard({
  onKey,
  style,
  ...rest
}) {
  const press = k => onKey ? () => onKey(k) : undefined;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "absolute",
      left: "-2px",
      right: "-2px",
      bottom: "-2px",
      borderRadius: "39px",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      padding: "24px 14px 40px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      ...style
    }
  }, rest), ROWS.map((row, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "flex",
      gap: "6px",
      justifyContent: "center"
    }
  }, row.map(k => {
    const glyph = k === "shift" || k === "backspace";
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      type: "button",
      onClick: press(k),
      "aria-label": k,
      style: key({
        width: glyph ? "44px" : "31px"
      })
    }, glyph ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: k,
      size: 22
    }) : k);
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "6px",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: press("123"),
    style: key({
      width: "56px",
      fontSize: "17px"
    })
  }, "123"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: press(" "),
    "aria-label": "Space",
    style: key({
      flex: 1
    })
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: press("Go"),
    style: key({
      width: "56px",
      fontSize: "17px"
    })
  }, "Go")));
}
Object.assign(__ds_scope, { Keyboard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/frame/Keyboard.jsx", error: String((e && e.message) || e) }); }

// components/frame/Keypad.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The numeric keypad from screen 212: three columns of wide #D0D8E2 keys, radius 9,
   with 0 centred on the last row and backspace to its right. */
function Keypad({
  onKey,
  style,
  ...rest
}) {
  const press = k => onKey ? () => onKey(k) : undefined;
  const key = {
    height: "36px",
    borderRadius: "9px",
    background: "var(--fill)",
    border: "none",
    display: "grid",
    placeItems: "center",
    font: "400 20px/1 var(--font-sans)",
    color: "var(--ink)",
    cursor: "pointer",
    padding: 0,
    transition: "var(--transition-state)"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "absolute",
      left: "-2px",
      right: "-2px",
      bottom: "-2px",
      borderRadius: "39px",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      padding: "26px 20px 44px",
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: "14px 12px",
      ...style
    }
  }, rest), ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => /*#__PURE__*/React.createElement("button", {
    key: d,
    type: "button",
    onClick: press(d),
    style: key
  }, d)), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: press("0"),
    style: key
  }, "0"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: press("backspace"),
    "aria-label": "Delete",
    style: {
      ...key,
      background: "transparent"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "backspace",
    size: 26
  })));
}
Object.assign(__ds_scope, { Keypad });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/frame/Keypad.jsx", error: String((e && e.message) || e) }); }

// components/frame/TabBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Two tab bars, both from the source set.
   minimal — five 28px outline circles on a 66px pitch, active one filled ink.
   dock    — a 98px paper capsule (radius 39, 2px stroke) holding 43×43 squircles
             (radius 19) with glyphs; active squircle fills ink, glyph goes white.
             Badges are 10px dots pinned to the top-right corner of a squircle. */
function TabBar({
  variant = "minimal",
  items = 5,
  active = 2,
  icons,
  badges = [],
  onSelect,
  style,
  ...rest
}) {
  const list = icons || Array.from({
    length: items
  }, () => null);
  if (variant === "minimal") {
    return /*#__PURE__*/React.createElement("div", _extends({
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "58px",
        display: "flex",
        justifyContent: "space-between",
        padding: "0 41px",
        ...style
      }
    }, rest), list.map((_, i) => /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      "aria-label": `Tab ${i + 1}`,
      onClick: onSelect ? () => onSelect(i) : undefined,
      style: {
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        padding: 0,
        flex: "none",
        border: "2px solid var(--ink)",
        background: i === active ? "var(--ink)" : "transparent",
        cursor: onSelect ? "pointer" : "default",
        transition: "var(--transition-state)"
      }
    })));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "absolute",
      left: "-2px",
      right: "-2px",
      bottom: "-2px",
      height: "98px",
      borderRadius: "39px",
      border: "2px solid var(--ink)",
      background: "var(--paper)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      padding: "25px 37px 0",
      ...style
    }
  }, rest), list.map((name, i) => {
    const on = i === active;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      "aria-label": name || `Tab ${i + 1}`,
      onClick: onSelect ? () => onSelect(i) : undefined,
      style: {
        position: "relative",
        width: "43px",
        height: "43px",
        borderRadius: "19px",
        padding: 0,
        flex: "none",
        border: "2px solid var(--ink)",
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--white)" : "var(--ink)",
        display: "grid",
        placeItems: "center",
        cursor: onSelect ? "pointer" : "default",
        transition: "var(--transition-state)"
      }
    }, name ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: name,
      size: 22
    }) : null, badges.includes(i) ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: "-1px",
        right: "-1px",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: on ? "var(--white)" : "var(--ink)",
        border: "2px solid var(--ink)",
        boxSizing: "content-box"
      }
    }) : null);
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/frame/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/media/MediaBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Placeholder art. Three fills, all from the source:
   wash  — slate at 35% with a matching 35% slate stroke (the default hero block)
   inked — slate at 35% with a 2px ink stroke (used inside outlined cards)
   solid — opaque #D0D8E2, no stroke (used for thumbnails and card headers) */
function MediaBlock({
  w = "100%",
  h = 295,
  radius = 40,
  variant = "wash",
  dots = 0,
  activeDot = 0,
  children,
  style,
  ...rest
}) {
  const fill = variant === "solid" ? {
    background: "var(--fill)",
    border: "2px solid transparent"
  } : variant === "inked" ? {
    background: "var(--slate-a35)",
    border: "2px solid var(--ink)"
  } : {
    background: "var(--slate-a35)",
    border: "2px solid var(--line-soft)"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      width: typeof w === "number" ? `${w}px` : w,
      height: typeof h === "number" ? `${h}px` : h,
      borderRadius: `${radius}px`,
      flex: "none",
      ...fill,
      ...style
    }
  }, rest), children, dots > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "14px",
      display: "flex",
      gap: "12px",
      justifyContent: "center"
    }
  }, Array.from({
    length: dots
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: "5px",
      height: "5px",
      borderRadius: "50%",
      background: "var(--ink)",
      opacity: i === activeDot ? 1 : 0.85
    }
  }))) : null);
}
Object.assign(__ds_scope, { MediaBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/MediaBlock.jsx", error: String((e && e.message) || e) }); }

// components/media/Carousel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* A media block with page dots. Clicking a dot moves the index; there is no slide
   animation in the source, so the component just tracks state. */
function Carousel({
  count = 5,
  index,
  onChange,
  h = 295,
  radius = 40,
  variant = "solid",
  style,
  ...rest
}) {
  const [i, setI] = React.useState(0);
  const active = index === undefined ? i : index;
  const go = n => {
    if (index === undefined) setI(n);
    if (onChange) onChange(n);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.MediaBlock, {
    h: h,
    radius: radius,
    variant: variant
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "16px",
      display: "flex",
      gap: "12px",
      justifyContent: "center"
    }
  }, Array.from({
    length: count
  }, (_, n) => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    "aria-label": `Slide ${n + 1}`,
    onClick: () => go(n),
    style: {
      width: "6px",
      height: "6px",
      padding: 0,
      borderRadius: "50%",
      border: "none",
      background: "var(--ink)",
      opacity: n === active ? 1 : 0.35,
      cursor: "pointer",
      transition: "var(--transition-state)"
    }
  }))));
}
Object.assign(__ds_scope, { Carousel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/Carousel.jsx", error: String((e && e.message) || e) }); }

// components/media/ProgressRing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Two rings from the source. `thin` is a 2px ink arc over a slate track with a readout in
   the middle; `thick` is a 30px gradient ring with no readout. */
function ProgressRing({
  size = 240,
  value = 0.72,
  variant = "thin",
  children,
  style,
  ...rest
}) {
  const sw = variant === "thick" ? 30 : 10;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const id = React.useId ? React.useId().replace(/:/g, "") : "pr";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      width: `${size}px`,
      height: `${size}px`,
      flex: "none",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, variant === "thick" ? /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: `g${id}`,
    x1: "0",
    y1: "1",
    x2: "1",
    y2: "0"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "var(--steel)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "55%",
    stopColor: "var(--fill-mid)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "var(--fill-soft)"
  }))) : null, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--fill)",
    strokeWidth: sw
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: variant === "thick" ? `url(#g${id})` : "var(--ink)",
    strokeWidth: variant === "thick" ? sw : 2,
    strokeLinecap: "round",
    strokeDasharray: `${c * value} ${c}`,
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  })), children ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center"
    }
  }, children) : null);
}
Object.assign(__ds_scope, { ProgressRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/ProgressRing.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Outline card. 2px ink stroke on paper, no fill, no shadow. Radius 29 is the workhorse
   (list cards, product rows); 19 for tiles and 9 for dense rows. */
function Card({
  children,
  radius = 29,
  pad = 0,
  inset = false,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      borderRadius: `${radius}px`,
      border: "2px solid var(--ink)",
      background: inset ? "var(--paper)" : "transparent",
      padding: typeof pad === "number" ? `${pad}px` : pad,
      transition: "var(--transition-state)",
      cursor: onClick ? "pointer" : undefined,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/DiamondTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* An 80×80 radius-19 square turned 45°, so the rounded corners cut the points off and it
   reads as a soft diamond ~90px across. The glyph inside is counter-rotated upright. */
function DiamondTile({
  size = 80,
  radius = 19,
  icon,
  iconSize = 34,
  variant = "outline",
  onClick,
  style,
  ...rest
}) {
  const fill = variant === "media" ? {
    background: "var(--slate-a35)",
    border: "2px solid var(--slate)"
  } : variant === "ink" ? {
    background: "var(--ink)",
    border: "2px solid var(--ink)"
  } : {
    background: "transparent",
    border: "2px solid var(--ink)"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${radius}px`,
      transform: "rotate(45deg)",
      display: "grid",
      placeItems: "center",
      flex: "none",
      color: variant === "ink" ? "var(--white)" : "var(--ink)",
      transition: "var(--transition-state)",
      cursor: onClick ? "pointer" : undefined,
      ...fill,
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("div", {
    style: {
      transform: "rotate(-45deg)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  })) : null);
}
Object.assign(__ds_scope, { DiamondTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/DiamondTile.jsx", error: String((e && e.message) || e) }); }

// components/collections/DiamondGrid.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Honeycomb of diamond tiles. Rows alternate 3 and 2 across, offset by half a pitch, on a
   104px horizontal / 82px vertical lattice. The source uses it for category browsing. */
function DiamondGrid({
  icons = [],
  rows = 4,
  size = 80,
  pitchX = 104,
  pitchY = 82,
  onSelect,
  style,
  ...rest
}) {
  let n = 0;
  const layout = [];
  for (let r = 0; r < rows; r += 1) {
    const per = r % 2 === 0 ? 3 : 2;
    const items = [];
    for (let c = 0; c < per; c += 1) {
      items.push({
        icon: icons[n % Math.max(1, icons.length)] || undefined,
        i: n
      });
      n += 1;
    }
    layout.push({
      items,
      offset: r % 2 === 0 ? 0 : pitchX / 2
    });
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: `${pitchY - size}px`,
      ...style
    }
  }, rest), layout.map((row, r) => /*#__PURE__*/React.createElement("div", {
    key: r,
    style: {
      display: "flex",
      gap: `${pitchX - size}px`,
      marginLeft: `${row.offset}px`
    }
  }, row.items.map(({
    icon,
    i
  }) => /*#__PURE__*/React.createElement(__ds_scope.DiamondTile, {
    key: i,
    icon: icon,
    size: size,
    onClick: onSelect ? () => onSelect(i) : undefined
  })))));
}
Object.assign(__ds_scope, { DiamondGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/DiamondGrid.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The inverted container. A solid ink slab, radius 29.5, holding paper cards. The kit's
   only way of grouping — it reads as "this set belongs together" without any label. */
function Panel({
  children,
  radius = 29.5,
  pad = 20,
  gap = 22,
  bleed = 0,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: `${radius}px`,
      background: "var(--ink)",
      padding: typeof pad === "number" ? `${pad}px` : pad,
      marginLeft: `${-bleed}px`,
      marginRight: `${-bleed}px`,
      display: "flex",
      flexDirection: "column",
      gap: `${gap}px`,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Panel.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Tile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The 73×73 squircle, radius 19 — the most repeated shape in the whole set.
   Four fills: outline (2px ink), media (slate at 35% + ink stroke), solid (#D0D8E2),
   soft (slate at 15%, the "chosen" state in select grids). */
const FILLS = {
  outline: {
    background: "transparent",
    border: "2px solid var(--ink)"
  },
  media: {
    background: "var(--slate-a35)",
    border: "2px solid var(--ink)"
  },
  "media-soft": {
    background: "var(--slate-a35)",
    border: "2px solid var(--slate)"
  },
  solid: {
    background: "var(--fill)",
    border: "2px solid var(--line-soft)"
  },
  soft: {
    background: "var(--slate-a15)",
    border: "2px solid var(--line-soft)"
  },
  ink: {
    background: "var(--ink)",
    border: "2px solid var(--ink)"
  }
};
function Tile({
  size = 73,
  radius = 19,
  variant = "outline",
  icon,
  iconSize = 26,
  children,
  onClick,
  style,
  ...rest
}) {
  const fill = FILLS[variant] || FILLS.outline;
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      width: typeof size === "number" ? `${size}px` : size,
      height: typeof size === "number" ? `${size}px` : size,
      borderRadius: `${radius}px`,
      flex: "none",
      display: "grid",
      placeItems: "center",
      color: variant === "ink" ? "var(--white)" : "var(--ink)",
      transition: "var(--transition-state)",
      cursor: onClick ? "pointer" : undefined,
      ...fill,
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }) : children);
}
Object.assign(__ds_scope, { Tile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Tile.jsx", error: String((e && e.message) || e) }); }

// components/text/TextBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* A flat bar. In this system a bar IS text: 5px tall for a heading, 3px tall for a line
   of body copy. Widths carry the meaning — 135 title, 105 subtitle, 285 full measure. */
function TextBar({
  w = 135,
  h = 5,
  tone = "ink",
  style,
  ...rest
}) {
  const bg = tone === "prose" ? "var(--slate)" : tone === "invert" ? "var(--white)" : "var(--ink-a50)";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: typeof w === "number" ? `${w}px` : w,
      height: `${h}px`,
      background: bg,
      opacity: tone === "ink" ? 0.6 : 1,
      flex: "none",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { TextBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/text/TextBar.jsx", error: String((e && e.message) || e) }); }

// components/controls/ChoiceRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Selection row. A full-width 48px pill filled #DCE0E9 with a 2px ink stroke, and a
   trailing marker holding a small diamond. Two marker shapes appear in the source:
   `capsule` (48×23) and `circle` (26). Selected fills ink and the diamond goes white. */
function ChoiceRow({
  selected = false,
  onSelect,
  marker = "capsule",
  label,
  labelW = 0,
  h = 48,
  style,
  ...rest
}) {
  const diamond = /*#__PURE__*/React.createElement("span", {
    style: {
      width: "8px",
      height: "8px",
      background: selected ? "var(--white)" : "var(--ink)",
      transform: "rotate(45deg)",
      flex: "none",
      transition: "var(--transition-state)"
    }
  });
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onSelect,
    role: "radio",
    "aria-checked": selected,
    style: {
      height: `${h}px`,
      borderRadius: "999px",
      border: "2px solid var(--ink)",
      background: "var(--fill-soft)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px 0 22px",
      cursor: onSelect ? "pointer" : "default",
      transition: "var(--transition-state)",
      ...style
    }
  }, rest), label || (labelW ? /*#__PURE__*/React.createElement(__ds_scope.TextBar, {
    w: labelW,
    h: 3
  }) : /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("span", {
    style: {
      width: marker === "circle" ? "26px" : "48px",
      height: marker === "circle" ? "26px" : "23px",
      borderRadius: "999px",
      border: "2px solid var(--ink)",
      background: selected ? "var(--ink)" : "transparent",
      display: "grid",
      placeItems: "center",
      flex: "none",
      transition: "var(--transition-state)"
    }
  }, diamond));
}
Object.assign(__ds_scope, { ChoiceRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/ChoiceRow.jsx", error: String((e && e.message) || e) }); }

// components/controls/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Text field. 285×48, radius 9, 2px ink stroke, and a centred 165×3 grey bar standing in
   for the value. Pass `value` to show real type instead of the bar. */
function Input({
  value,
  onChange,
  placeholder,
  h = 48,
  radius = 9,
  align = "center",
  barW = 165,
  style,
  ...rest
}) {
  const live = value !== undefined && onChange !== undefined;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      height: `${h}px`,
      borderRadius: `${radius}px`,
      border: "2px solid var(--ink)",
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: align === "center" ? "center" : "flex-start",
      padding: "0 18px",
      transition: "var(--transition-state)",
      ...style
    }
  }, rest), live ? /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    style: {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      font: "400 var(--text-md)/1 var(--font-sans)",
      color: "var(--ink)",
      textAlign: align === "center" ? "center" : "left"
    }
  }) : /*#__PURE__*/React.createElement(__ds_scope.TextBar, {
    w: barW,
    h: 3
  }));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Input.jsx", error: String((e && e.message) || e) }); }

// components/text/TextBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* A paragraph of placeholder prose: 3px slate bars on a 13px pitch, with the last line
   short. Line widths alternate full / inset so the block reads as ragged copy. */
function TextBlock({
  lines = 6,
  w = 285,
  h = 3,
  gap = 10,
  tone = "prose",
  ragged = true,
  style,
  ...rest
}) {
  const widths = [];
  for (let i = 0; i < lines; i += 1) {
    if (!ragged) widths.push(w);else if (i === lines - 1) widths.push(Math.round(w * 0.82));else widths.push(i % 2 === 0 ? w : Math.round(w * 0.86));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: `${gap}px`,
      ...style
    }
  }, rest), widths.map((lw, i) => /*#__PURE__*/React.createElement(__ds_scope.TextBar, {
    key: i,
    w: lw,
    h: h,
    tone: tone
  })));
}
Object.assign(__ds_scope, { TextBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/text/TextBlock.jsx", error: String((e && e.message) || e) }); }

// components/text/TitleBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Title + subtitle pair. 5px bars, 135 then 105 wide, 10px apart (15px pitch).
   The single most repeated element in the source set — it opens almost every screen. */
function TitleBlock({
  w = 135,
  subW = 105,
  h = 5,
  gap = 10,
  tone = "ink",
  subtitle = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: `${gap}px`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.TextBar, {
    w: w,
    h: h,
    tone: tone
  }), subtitle ? /*#__PURE__*/React.createElement(__ds_scope.TextBar, {
    w: subW,
    h: h,
    tone: tone
  }) : null);
}
Object.assign(__ds_scope, { TitleBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/text/TitleBlock.jsx", error: String((e && e.message) || e) }); }

// components/collections/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* List row: a 43px leading circle, a 3px label pair, and a trailing control.
   Rows sit on a 70px pitch with no divider — the whitespace does the separating. */
function ListRow({
  leading,
  avatar = true,
  avatarFilled = false,
  labelW = 135,
  subW = 105,
  trailing,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "18px",
      minHeight: "43px",
      cursor: onClick ? "pointer" : undefined,
      ...style
    }
  }, rest), leading || (avatar ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: "43px",
      height: "43px",
      borderRadius: "50%",
      flex: "none",
      border: avatarFilled ? "none" : "2px solid var(--ink)",
      background: avatarFilled ? "var(--ink)" : "transparent"
    }
  }) : null), /*#__PURE__*/React.createElement(__ds_scope.TitleBlock, {
    w: labelW,
    subW: subW,
    h: 3,
    gap: 11
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "14px"
    }
  }, trailing));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/collections/ProductRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Product row: a 93px outline card at radius 29 holding a 68px media tile, two slate label
   bars, and a trailing glyph. The source stacks these six deep with a 22px gap. */
function ProductRow({
  icon,
  thumbIcon,
  labelW = 135,
  subW = 105,
  trailing = "plus",
  trailingActive = false,
  inset = false,
  onClick,
  style,
  ...rest
}) {
  const glyph = trailing === "heart" ? trailingActive ? "heart-filled" : "heart" : trailing;
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      height: "93px",
      borderRadius: "29px",
      border: "2px solid var(--ink)",
      background: inset ? "var(--paper)" : "transparent",
      display: "flex",
      alignItems: "center",
      gap: "13px",
      padding: "0 22px 0 12px",
      flex: "none",
      cursor: onClick ? "pointer" : undefined,
      transition: "var(--transition-state)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Tile, {
    size: 68,
    variant: "media",
    icon: thumbIcon || icon,
    iconSize: 24
  }), /*#__PURE__*/React.createElement(__ds_scope.TitleBlock, {
    w: labelW,
    subW: subW,
    h: 3,
    gap: 10,
    tone: "prose"
  }), glyph ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      color: "var(--ink)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: glyph,
    size: glyph.startsWith("heart") ? 22 : 16
  })) : null);
}
Object.assign(__ds_scope, { ProductRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/ProductRow.jsx", error: String((e && e.message) || e) }); }

// components/collections/StatRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Three or six evenly-spaced stats, each a 43px ring over a short label pair.
   Used for quick-action grids in bottom sheets and for figures on profile screens. */
function StatRow({
  items = 3,
  columns = 3,
  icons,
  onSelect,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${columns},1fr)`,
      gap: "30px 0",
      justifyItems: "center",
      ...style
    }
  }, rest), Array.from({
    length: items
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      cursor: onSelect ? "pointer" : undefined
    },
    onClick: onSelect ? () => onSelect(i) : undefined
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "43px",
      height: "43px",
      borderRadius: "50%",
      border: "2px solid var(--ink)",
      display: "grid",
      placeItems: "center"
    }
  }, icons && icons[i] ? icons[i] : null), /*#__PURE__*/React.createElement(__ds_scope.TitleBlock, {
    w: 72,
    subW: 50,
    h: 5,
    gap: 7,
    style: {
      alignItems: "center"
    }
  }))));
}
Object.assign(__ds_scope, { StatRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/collections/StatRow.jsx", error: String((e && e.message) || e) }); }

// components/frame/ScreenHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Screen header. Three slots: an optional 43×43 back squircle, the title bar pair, and an
   optional trailing 43px ink avatar or control. Everything sits on a 72.5px centreline. */
function ScreenHeader({
  back = false,
  onBack,
  avatar = false,
  trailing,
  title = true,
  titleW = 135,
  subW = 105,
  style,
  ...rest
}) {
  const square = {
    width: "43px",
    height: "43px",
    borderRadius: "19px",
    border: "2px solid var(--ink)",
    background: "transparent",
    display: "grid",
    placeItems: "center",
    padding: 0,
    cursor: onBack ? "pointer" : "default",
    transition: "var(--transition-state)",
    flex: "none"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "20px",
      minHeight: "43px",
      ...style
    }
  }, rest), back ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Back",
    onClick: onBack,
    style: square
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-left",
    size: 22
  })) : null, title ? /*#__PURE__*/React.createElement(__ds_scope.TitleBlock, {
    w: titleW,
    subW: subW
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "10px"
    }
  }, trailing, avatar ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: "43px",
      height: "43px",
      borderRadius: "50%",
      background: "var(--ink)",
      flex: "none"
    }
  }) : null));
}
Object.assign(__ds_scope, { ScreenHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/frame/ScreenHeader.jsx", error: String((e && e.message) || e) }); }

// components/media/MediaCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Media on top, two label bars below, one 2px ink outline around the whole thing.
   The media's bottom corners are square so it meets the caption flush. */
function MediaCard({
  w = "100%",
  h = 133,
  mediaH = 84,
  radius = 19,
  labelW = 95,
  subW = 65,
  onClick,
  trailing,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      position: "relative",
      width: typeof w === "number" ? `${w}px` : w,
      height: typeof h === "number" ? `${h}px` : h,
      borderRadius: `${radius}px`,
      border: "2px solid var(--ink)",
      overflow: "hidden",
      flex: "none",
      display: "flex",
      flexDirection: "column",
      transition: "var(--transition-state)",
      cursor: onClick ? "pointer" : undefined,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: `${mediaH}px`,
      background: "var(--slate-a35)",
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 17px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TitleBlock, {
    w: labelW,
    subW: subW,
    h: 5,
    gap: 10
  }), trailing));
}
Object.assign(__ds_scope, { MediaCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/MediaCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/BrowseScreen.jsx
try { (() => {
const {
  PhoneFrame,
  ScreenHeader,
  TabBar,
  MediaCard,
  TileRow,
  TitleBlock,
  DiamondGrid,
  Card,
  Tile,
  Icon,
  TextBar
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 008 — the browse screen.
   Outline card rail, media-card rail with add buttons, diamond category honeycomb, dock. */
function BrowseScreen({
  onOpen,
  onTab,
  tab
}) {
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 51
  }, /*#__PURE__*/React.createElement(ScreenHeader, {
    avatar: true,
    title: false,
    back: true,
    onBack: onOpen && (() => onOpen("catalogue"))
  }), /*#__PURE__*/React.createElement(TileRow, {
    gap: 19,
    style: {
      marginTop: 26
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement(Card, {
    key: i,
    radius: 19,
    style: {
      width: 160,
      height: 130,
      flex: "none"
    }
  }))), /*#__PURE__*/React.createElement(TitleBlock, {
    style: {
      marginTop: 25
    }
  }), /*#__PURE__*/React.createElement(TileRow, {
    gap: 19,
    style: {
      marginTop: 22
    }
  }, ["carrot", "jar", "cherries"].map((n, i) => /*#__PURE__*/React.createElement(MediaCard, {
    key: n,
    w: 145,
    h: 130,
    mediaH: 82,
    radius: 19,
    labelW: 95,
    subW: 65,
    onClick: onOpen ? () => onOpen("catalogue") : undefined,
    trailing: null,
    style: {
      flex: "none"
    }
  }))), /*#__PURE__*/React.createElement(TitleBlock, {
    style: {
      marginTop: 25
    }
  }), /*#__PURE__*/React.createElement(DiamondGrid, {
    icons: ["cherries", "cocktail", "drumstick", "carrot", "jar", "bottle", "asterisk", "cocktail"],
    rows: 3,
    size: 80,
    pitchX: 104,
    pitchY: 82,
    style: {
      marginTop: 24,
      marginLeft: -6
    },
    onSelect: onOpen ? () => onOpen("catalogue") : undefined
  }), /*#__PURE__*/React.createElement(TabBar, {
    variant: "dock",
    icons: ["home", "note-edit", "chef-hat", "cart"],
    active: tab,
    badges: [3],
    onSelect: onTab
  }));
}

/* The rail media cards in the source carry a plus in the middle of the media band. */
function AddOverlay() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  }));
}
Object.assign(window, {
  BrowseScreen,
  AddOverlay
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/BrowseScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/CatalogueScreen.jsx
try { (() => {
const {
  PhoneFrame,
  ScreenHeader,
  ProductRow
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 207 — the catalogue list.
   Six 93px product rows on a 22px gap, each with a media tile and a trailing plus. */
function CatalogueScreen({
  onBack,
  onAdd,
  added = []
}) {
  const items = ["carrot", "jar", "cherries", "cocktail", "drumstick", "bottle"];
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 51
  }, /*#__PURE__*/React.createElement(ScreenHeader, {
    back: true,
    onBack: onBack,
    avatar: true,
    title: false
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 22,
      marginTop: 32
    }
  }, items.map((icon, i) => /*#__PURE__*/React.createElement(ProductRow, {
    key: icon,
    icon: icon,
    trailing: added.includes(i) ? "check" : "plus",
    onClick: onAdd ? () => onAdd(i) : undefined
  }))));
}
Object.assign(window, {
  CatalogueScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/CatalogueScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/PickerScreen.jsx
try { (() => {
const {
  PhoneFrame,
  SearchBar,
  NumberGrid,
  ProgressPill,
  Tile,
  Button,
  TabBar
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 209 — the date picker.
   Search pill with a solid action, a 7-column numeral grid, a split pill, three glyph tiles. */
function PickerScreen({
  onBack,
  onTab,
  tab,
  onConfirm
}) {
  const [day, setDay] = React.useState(18);
  const [shape, setShape] = React.useState(0);
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 51
  }, /*#__PURE__*/React.createElement(SearchBar, {
    action: "solid",
    onAction: onBack
  }), /*#__PURE__*/React.createElement(NumberGrid, {
    count: 30,
    selected: day,
    onSelect: setDay,
    style: {
      marginTop: 42
    }
  }), /*#__PURE__*/React.createElement(ProgressPill, {
    value: 0.51,
    align: "start",
    style: {
      marginTop: 44
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 40
    }
  }, ["venn", "blob-two", "blossom"].map((n, i) => /*#__PURE__*/React.createElement(Tile, {
    key: n,
    size: 73,
    radius: 19,
    variant: shape === i ? "soft" : "outline",
    icon: n,
    iconSize: 30,
    onClick: () => setShape(i)
  }))), /*#__PURE__*/React.createElement(Button, {
    variant: "soft",
    full: true,
    h: 54,
    style: {
      marginTop: 42
    },
    onClick: onConfirm
  }), /*#__PURE__*/React.createElement(TabBar, {
    active: tab,
    onSelect: onTab
  }));
}
Object.assign(window, {
  PickerScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/PickerScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/SavedScreen.jsx
try { (() => {
const {
  PhoneFrame,
  ScreenHeader,
  Panel,
  ProductRow,
  TabBar
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 208 — the saved set.
   An ink panel bleeding to x=28 holding five paper rows, each with a favourite toggle. */
function SavedScreen({
  onBack,
  onTab,
  tab,
  liked = [1, 3, 4],
  onLike
}) {
  const items = ["refresh", "refresh", "refresh", "refresh", "refresh"];
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 51
  }, /*#__PURE__*/React.createElement(ScreenHeader, {
    back: true,
    onBack: onBack,
    avatar: true,
    title: false
  }), /*#__PURE__*/React.createElement(Panel, {
    bleed: 16,
    pad: 22,
    gap: 22,
    style: {
      marginTop: 22
    }
  }, items.map((icon, i) => /*#__PURE__*/React.createElement(ProductRow, {
    key: i,
    icon: icon,
    inset: true,
    trailing: "heart",
    trailingActive: liked.includes(i),
    onClick: onLike ? () => onLike(i) : undefined,
    style: {
      width: 273
    }
  }))), /*#__PURE__*/React.createElement(TabBar, {
    variant: "dock",
    icons: ["home", "note-edit", "chef-hat", "cart"],
    active: tab,
    badges: [2, 3],
    onSelect: onTab
  }));
}
Object.assign(window, {
  SavedScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/SavedScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/SettingsSheetScreen.jsx
try { (() => {
const {
  PhoneFrame,
  MediaBlock,
  BottomSheet,
  TitleBlock,
  Switch,
  Button,
  ScreenHeader
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 101 — hero media with a settings sheet over it.
   Note the sheet's top edge cuts across the media block rather than dimming it; the kit
   has no scrim and no blur. */
function SettingsSheetScreen({
  onClose
}) {
  const [flags, setFlags] = React.useState([true, false, false]);
  const set = i => setFlags(f => f.map((v, n) => n === i ? !v : v));
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 80
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TitleBlock, null), /*#__PURE__*/React.createElement(Switch, {
    checked: flags[0],
    onChange: () => set(0)
  })), /*#__PURE__*/React.createElement(MediaBlock, {
    h: 295,
    radius: 40,
    style: {
      marginTop: 30
    }
  }), /*#__PURE__*/React.createElement(BottomSheet, {
    h: 350
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 37
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TitleBlock, {
    h: 5,
    gap: 10
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: flags[i],
    onChange: () => set(i)
  })))), /*#__PURE__*/React.createElement(Button, {
    full: true,
    h: 60,
    onClick: onClose,
    style: {
      marginTop: 40
    }
  })));
}
Object.assign(window, {
  SettingsSheetScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/SettingsSheetScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/SignInScreen.jsx
try { (() => {
const {
  PhoneFrame,
  Input,
  Button,
  TextBar
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 002 — sign in.
   A filled avatar, two fields with hint bars beneath, one primary pill at the bottom. */
function SignInScreen({
  onSubmit
}) {
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 81
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 43,
      height: 43,
      borderRadius: "50%",
      background: "var(--ink)",
      alignSelf: "center",
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement(Input, {
    style: {
      marginTop: 190
    }
  }), /*#__PURE__*/React.createElement(TextBar, {
    w: 165,
    h: 3,
    style: {
      alignSelf: "center",
      marginTop: 21
    }
  }), /*#__PURE__*/React.createElement(Input, {
    style: {
      marginTop: 21
    }
  }), /*#__PURE__*/React.createElement(TextBar, {
    w: 165,
    h: 3,
    style: {
      alignSelf: "center",
      marginTop: 21
    }
  }), /*#__PURE__*/React.createElement(TextBar, {
    w: 165,
    h: 3,
    style: {
      alignSelf: "center",
      marginTop: 20
    }
  }), /*#__PURE__*/React.createElement(Button, {
    full: true,
    onClick: onSubmit,
    style: {
      position: "absolute",
      left: 60,
      right: 60,
      bottom: 62,
      width: "auto"
    }
  }));
}
Object.assign(window, {
  SignInScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/SignInScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile-flows/TunerScreen.jsx
try { (() => {
const {
  PhoneFrame,
  ScreenHeader,
  TitleBlock,
  RangeSlider,
  ProgressPill,
  ChoiceRow,
  Button,
  TabBar
} = window.PaperWireframeDesignSystem_72d81a;

/* Recreation of source screen 110 — the adjust screen.
   A range slider, two split pills filling from opposite ends, and two radio rows. */
function TunerScreen({
  onBack,
  onTab,
  tab
}) {
  const [choice, setChoice] = React.useState(0);
  const [span, setSpan] = React.useState([0.24, 0.52]);
  return /*#__PURE__*/React.createElement(PhoneFrame, {
    top: 51
  }, /*#__PURE__*/React.createElement(ScreenHeader, {
    back: true,
    onBack: onBack,
    avatar: true,
    title: false
  }), /*#__PURE__*/React.createElement(TitleBlock, {
    style: {
      marginTop: 32
    }
  }), /*#__PURE__*/React.createElement(RangeSlider, {
    from: span[0],
    to: span[1],
    style: {
      marginTop: 34
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(ProgressPill, {
    value: 0.54,
    align: "end"
  }), /*#__PURE__*/React.createElement(ChoiceRow, {
    marker: "circle",
    selected: choice === 0,
    onSelect: () => setChoice(0)
  }), /*#__PURE__*/React.createElement(ChoiceRow, {
    marker: "circle",
    selected: choice === 1,
    onSelect: () => setChoice(1)
  }), /*#__PURE__*/React.createElement(ProgressPill, {
    value: 0.47,
    align: "start"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "soft",
    full: true,
    h: 54,
    style: {
      marginTop: 34
    },
    onClick: () => setSpan([0.24, 0.52])
  }), /*#__PURE__*/React.createElement(TabBar, {
    active: tab,
    onSelect: onTab
  }));
}
Object.assign(window, {
  TunerScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-flows/TunerScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.DiamondGrid = __ds_scope.DiamondGrid;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.ProductRow = __ds_scope.ProductRow;

__ds_ns.Rating = __ds_scope.Rating;

__ds_ns.SelectGrid = __ds_scope.SelectGrid;

__ds_ns.StatRow = __ds_scope.StatRow;

__ds_ns.TileRow = __ds_scope.TileRow;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.CheckCircle = __ds_scope.CheckCircle;

__ds_ns.ChoiceRow = __ds_scope.ChoiceRow;

__ds_ns.CodeInput = __ds_scope.CodeInput;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.NumberGrid = __ds_scope.NumberGrid;

__ds_ns.ProgressPill = __ds_scope.ProgressPill;

__ds_ns.RangeSlider = __ds_scope.RangeSlider;

__ds_ns.SearchBar = __ds_scope.SearchBar;

__ds_ns.Slider = __ds_scope.Slider;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.VerticalSlider = __ds_scope.VerticalSlider;

__ds_ns.BottomSheet = __ds_scope.BottomSheet;

__ds_ns.Keyboard = __ds_scope.Keyboard;

__ds_ns.Keypad = __ds_scope.Keypad;

__ds_ns.PhoneFrame = __ds_scope.PhoneFrame;

__ds_ns.ScreenHeader = __ds_scope.ScreenHeader;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Carousel = __ds_scope.Carousel;

__ds_ns.MediaBlock = __ds_scope.MediaBlock;

__ds_ns.MediaCard = __ds_scope.MediaCard;

__ds_ns.ProgressRing = __ds_scope.ProgressRing;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.DiamondTile = __ds_scope.DiamondTile;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.Tile = __ds_scope.Tile;

__ds_ns.TextBar = __ds_scope.TextBar;

__ds_ns.TextBlock = __ds_scope.TextBlock;

__ds_ns.TitleBlock = __ds_scope.TitleBlock;

})();
