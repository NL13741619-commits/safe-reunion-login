/* =========================================================
   安全團聚｜群組定位固定識別系統
   ---------------------------------------------------------
   用途：
   1. 群組成員固定顏色
   2. 群組成員固定形狀
   3. 顏色＋形狀組合不可重複
   4. SOS 紅色保留
   5. 不影響個人導航 Marker
   ========================================================= */

(function () {
  "use strict";

  /*
   * SOS 專用顏色
   * 一般群組成員絕對不能使用
   */
  const SOS_COLOR = "#ff0000";

  /*
   * 一般群組定位使用的顏色
   *
   * 注意：
   * 不把紅色放進來。
   */
  const GROUP_COLORS = [
    "#2196F3",
    "#00A878",
    "#FF9800",
    "#9C27B0",
    "#00BCD4",
    "#795548",
    "#3F51B5",
    "#009688",
    "#E91E63",
    "#673AB7",
    "#03A9F4",
    "#4CAF50",
    "#FF5722",
    "#8BC34A",
    "#607D8B"
  ];

  /*
   * 形狀
   *
   * 同一個顏色可以搭配不同形狀，
   * 因此可以支援遠超過 50 人。
   */
  const GROUP_SHAPES = [
    "circle",
    "square",
    "triangle",
    "diamond",
    "star",
    "hexagon",
    "pentagon",
    "plus"
  ];

  /*
   * 產生唯一組合
   *
   * 例如：
   *
   * 1 + 1
   * 1 + 2
   * 1 + 3
   * ...
   *
   * 這樣 15 色 × 8 形狀
   * = 120 種組合
   *
   * SOS 紅色不包含在這裡。
   */
  function getIdentifierPool() {

    const pool = [];

    let slotNo = 1;

    for (let colorIndex = 0; colorIndex < GROUP_COLORS.length; colorIndex++) {

      for (
        let shapeIndex = 0;
        shapeIndex < GROUP_SHAPES.length;
        shapeIndex++
      ) {

        pool.push({
          slot_no: slotNo,

          color_id: colorIndex + 1,

          shape_id: shapeIndex + 1,

          color: GROUP_COLORS[colorIndex],

          shape: GROUP_SHAPES[shapeIndex],

          is_sos_reserved: false
        });

        slotNo++;
      }
    }

    return pool;
  }


  /*
   * 取得識別池
   */
  const IDENTIFIER_POOL = getIdentifierPool();


  /*
   * 找出識別
   */
  function findIdentifier(colorId, shapeId) {

    return IDENTIFIER_POOL.find(function (item) {

      return (
        Number(item.color_id) === Number(colorId) &&
        Number(item.shape_id) === Number(shapeId)
      );

    }) || null;
  }


  /*
   * 將資料轉成地圖 Marker 所需要的資料
   */
  function createMemberIdentifier(row) {

    if (!row) {
      return null;
    }

    /*
     * SOS 永遠優先
     */
    if (row.is_sos === true) {

      return {
        color: SOS_COLOR,
        shape: "sos",
        color_id: null,
        shape_id: null,
        slot_no: null,
        is_sos: true
      };
    }


    const identifier = findIdentifier(
      row.color_id,
      row.shape_id
    );


    if (!identifier) {

      console.warn(
        "[安全團聚] 找不到群組定位識別：",
        row
      );

      return null;
    }


    return {

      color: identifier.color,

      shape: identifier.shape,

      color_id: identifier.color_id,

      shape_id: identifier.shape_id,

      slot_no: identifier.slot_no,

      is_sos: false

    };
  }


  /*
   * 建立 SVG Marker
   *
   * 這裡不使用 Leaflet 預設綠色 Marker。
   */
  function createMemberMarkerSVG(identifier, label) {

    if (!identifier) {
      return "";
    }


    /*
     * SOS
     */
    if (identifier.is_sos) {

      return `
        <div
          class="group-member-marker group-member-sos"
          title="${escapeHTML(label || "SOS")}"
        >
          <div class="group-member-sos-icon">
            SOS
          </div>
        </div>
      `;
    }


    const color = identifier.color;


    let shapeHTML = "";


    switch (identifier.shape) {

      case "circle":

        shapeHTML = `
          <div
            class="member-shape member-circle"
            style="background:${color}"
          ></div>
        `;

        break;


      case "square":

        shapeHTML = `
          <div
            class="member-shape member-square"
            style="background:${color}"
          ></div>
        `;

        break;


      case "triangle":

        shapeHTML = `
          <div
            class="member-shape member-triangle"
            style="
              border-bottom-color:${color};
            "
          ></div>
        `;

        break;


      case "diamond":

        shapeHTML = `
          <div
            class="member-shape member-diamond"
            style="background:${color}"
          ></div>
        `;

        break;


      case "star":

        shapeHTML = `
          <div
            class="member-shape member-star"
            style="color:${color}"
          >★</div>
        `;

        break;


      case "hexagon":

        shapeHTML = `
          <div
            class="member-shape member-hexagon"
            style="background:${color}"
          ></div>
        `;

        break;


      case "pentagon":

        shapeHTML = `
          <div
            class="member-shape member-pentagon"
            style="background:${color}"
          ></div>
        `;

        break;


      case "plus":

        shapeHTML = `
          <div
            class="member-shape member-plus"
            style="color:${color}"
          >✚</div>
        `;

        break;


      default:

        shapeHTML = `
          <div
            class="member-shape member-circle"
            style="background:${color}"
          ></div>
        `;

        break;
    }


    return `
      <div
        class="group-member-marker"
        title="${escapeHTML(label || "")}"
      >
        ${shapeHTML}
      </div>
    `;
  }


  /*
   * HTML 安全處理
   */
  function escapeHTML(value) {

    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /*
   * 對外公開
   *
   * 主頁之後只需要：
   *
   * window.GroupLocationIdentifiers.xxx
   */
  window.GroupLocationIdentifiers = {

    SOS_COLOR,

    GROUP_COLORS,

    GROUP_SHAPES,

    IDENTIFIER_POOL,

    findIdentifier,

    createMemberIdentifier,

    createMemberMarkerSVG

  };


  console.log(
    "[安全團聚] 群組定位識別系統載入完成，共",
    IDENTIFIER_POOL.length,
    "種一般成員識別"
  );

})();
