(function () {
  // 옵션값 캐싱
  let options = {
    splitTable: true,
    submittedStrike: true,
    showExpiredUnsubmitted: true
  };

  function loadOptionsAndApply() {
    chrome.storage.local.get(['splitTable', 'submittedStrike', 'showExpiredUnsubmitted'], function (result) {
      options.splitTable = !!result.splitTable;
      options.submittedStrike = !!result.submittedStrike;
      options.showExpiredUnsubmitted = result.showExpiredUnsubmitted !== false;
      applyAssignmentList();
    });
  }

  // 과제 목록 적용 함수
  function applyAssignmentList() {
    if (document.querySelector(".table_basics_area")) {
      if (options.splitTable) {
        sortAndStyleAssignmentList_With_Split_Table();
      } else {
        sortAndStyleAssignmentList();
      }
    }
  }
  
  function sortAndStyleAssignmentList_With_Split_Table() {
    const container = document.querySelector(".table_basics_com_cont_area");
    if (!container) return;
    const table = container.querySelector("table");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));

    function parseDeadline(dateStr) {
      const [datePart, timePart] = dateStr.trim().split(" ");
      const [year, month, day] = datePart.split(".").map(Number);
      if (timePart === "00:00") {
        const prevDay = new Date(year, month - 1, day);
        prevDay.setDate(prevDay.getDate() - 1);
        prevDay.setHours(23, 59, 0, 0);
        return prevDay;
      } else {
        const [hour, minute] = timePart.split(":").map(Number);
        return new Date(year, month - 1, day, hour, minute);
      }
    }

    function formatDate(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const hour = date.getHours().toString().padStart(2, "0");
      const minute = date.getMinutes().toString().padStart(2, "0");
      return `${year}.${month}.${day} ${hour}:${minute}`;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const categories = {
      urgent: [],
      notSubmitted: [],
      submitted: [],
      expired: [],
      submittedExpired: [],
    };

    rows.forEach((row) => {
      const statusCell = row.cells[3];
      const periodCell = row.cells[2];
      const periodText = periodCell.textContent.trim().replace(/\(.*?\)/g, '').trim();
      const deadlineStr = periodText.split('~')[1]?.trim() || "";
      if (!deadlineStr) return;
      const deadline = parseDeadline(deadlineStr);
      row._deadline = deadline;
      const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
      const diffDays = (deadlineDate - today) / (24 * 60 * 60 * 1000);
      const diffMs = deadline - now;
      const isSubmitted = statusCell.textContent.includes("제출완료");
      const isExpired = diffMs <= 0;
      let remainingStr = "";
      if (diffMs > 0) {
        if (diffMs >= 24 * 60 * 60 * 1000) {
          const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          remainingStr = ` (${days}일 전)`;
        } else {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          remainingStr = ` (${hours}시간 ${minutes}분 전)`;
        }
      } else {
        remainingStr = " (마감됨)";
      }
      periodCell.textContent = `${formatDate(deadline)}${remainingStr}`;

      if (isExpired && isSubmitted) {
        categories.submittedExpired.push(row);
      } else if (isExpired) {
        categories.expired.push(row);
      } else if (isSubmitted) {
        categories.submitted.push(row);
      } else if (diffDays >= 0 && diffDays <= 3) {
        categories.urgent.push(row);
      } else {
        categories.notSubmitted.push(row);
      }
    });

    Object.values(categories).forEach((categoryRows) => {
      categoryRows.sort((a, b) => a._deadline - b._deadline);
    });

    function createTable(title, rows) {
      const newTable = table.cloneNode(true);
      const newTbody = newTable.querySelector("tbody");
      newTbody.innerHTML = "";
      rows.forEach((row, idx) => {
        const numCell = row.querySelector(".num");
        if (numCell) numCell.textContent = idx + 1;
        newTbody.appendChild(row);
      });
      const header = document.createElement("h3");
      header.textContent = title;
      header.style.fontSize = "1.5em";
      header.style.marginTop = "20px";
      header.style.marginBottom = "10px";
      header.style.fontWeight = "bold";
      container.appendChild(header);
      container.appendChild(newTable);
      return newTable;
    }

    function styleRows(table, bgColor, textDecoration) {
      const tbody = table.querySelector("tbody");
      const rows = tbody ? tbody.querySelectorAll("tr") : [];
      rows.forEach((row) => {
        if (bgColor) {
          row.style.backgroundColor = bgColor;
          row.querySelectorAll("td").forEach((td) => (td.style.backgroundColor = bgColor));
        }
        if (textDecoration) {
          row.style.color = "gray";
          row.style.textDecoration = textDecoration;
          row.querySelectorAll("td").forEach((td) => {
            td.style.color = "gray";
            td.style.textDecoration = textDecoration;
          });
          row.querySelectorAll(".txt").forEach((el) => {
            el.style.color = "gray";
            el.style.textDecoration = textDecoration;
          });
        }
      });
    }

    // 카테고리별 테이블 생성 및 스타일링
    if (categories.urgent.length > 0) {
      const urgentTable = createTable("기한이 얼마 안 남은 과제 (3일 이내)", categories.urgent);
      styleRows(urgentTable, "#ffcccc");
    }
    if (categories.notSubmitted.length > 0) {
      createTable("제출 안 한 과제", categories.notSubmitted);
    }
    if (categories.submitted.length > 0) {
      const submittedTable = createTable("제출 완료", categories.submitted);
      if (options.submittedStrike) {
        styleRows(submittedTable, "#cce5ff", "line-through");
      } else {
        styleRows(submittedTable, "#cce5ff", null);
      }
    }
    // 마감 미제출 과제 표시 옵션
    if (options.showExpiredUnsubmitted && categories.expired.length > 0) {
      const expiredTable = createTable("마감된 과제", categories.expired);
      styleRows(expiredTable, "gray", "line-through");
    }
    if (categories.submittedExpired.length > 0) {
      const submittedExpiredTable = createTable("제출 완료한 마감된 과제", categories.submittedExpired);
      styleRows(submittedExpiredTable, "#cce5ff", "line-through");
    }
    table.remove();
  }

  function sortAndStyleAssignmentList() {
    const table = document.querySelector(".table_basics_area");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));

    function parseDeadline(dateStr) {
      const [datePart, timePart] = dateStr.trim().split(" ");
      const [year, month, day] = datePart.split(".").map(Number);
      if (timePart === "00:00") {
        const prevDay = new Date(year, month - 1, day);
        prevDay.setDate(prevDay.getDate() - 1);
        prevDay.setHours(23, 59, 0, 0);
        return prevDay;
      } else {
        const [hour, minute] = timePart.split(":").map(Number);
        return new Date(year, month - 1, day, hour, minute);
      }
    }

    function formatDate(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const hour = date.getHours().toString().padStart(2, "0");
      const minute = date.getMinutes().toString().padStart(2, "0");
      return `${year}.${month}.${day} ${hour}:${minute}`;
    }

    rows.sort((a, b) => {
      const aText = a.cells[2].textContent.trim().replace(/\(.*?\)/g, '').trim();
      const bText = b.cells[2].textContent.trim().replace(/\(.*?\)/g, '').trim();
      const aDeadlineStr = aText.split("~")[1]?.trim() || "";
      const bDeadlineStr = bText.split("~")[1]?.trim() || "";
      const aDeadline = parseDeadline(aDeadlineStr);
      const bDeadline = parseDeadline(bDeadlineStr);
      return aDeadline - bDeadline;
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    rows.forEach((row, idx) => {
      const numCell = row.querySelector(".num");
      if (numCell) numCell.textContent = idx + 1;
    });

    rows.forEach((row) => {
      tbody.appendChild(row);
      const statusCell = row.cells[3];
      const periodCell = row.cells[2];
      const periodText = periodCell.textContent.trim().replace(/\(.*?\)/g, '').trim();
      const deadlineStr = periodText.split('~')[1]?.trim() || "";
      if (!deadlineStr) return;
      const deadline = parseDeadline(deadlineStr);
      const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
      const diffDays = (deadlineDate - today) / (24 * 60 * 60 * 1000);
      const diffMs = deadline - new Date();
      let remainingStr = "";
      if (diffMs > 0) {
        if (diffMs >= 24 * 60 * 60 * 1000) {
          const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          remainingStr = ` (${days}일 전)`;
        } else {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          remainingStr = ` (${hours}시간 ${minutes}분 전)`;
        }
      } else {
        remainingStr = " (마감됨)";
      }
      const formattedDeadline = formatDate(deadline);
      periodCell.textContent = formattedDeadline + remainingStr;

      // 스타일 적용
      function applyStyle(property, value) {
        row.style.setProperty(property, value, "important");
        row.querySelectorAll("td").forEach((td) => {
          td.style.setProperty(property, value, "important");
        });
      }
      function applyStyleMultiple(styles) {
        for (const [prop, val] of Object.entries(styles)) {
          row.style.setProperty(prop, val, "important");
          row.querySelectorAll("td").forEach((td) => {
            td.style.setProperty(prop, val, "important");
          });
        }
      }

      if (statusCell && statusCell.textContent.includes("제출완료")) {
        if (deadlineDate < today) {
          applyStyleMultiple({
            color: "gray",
            "text-decoration": options.submittedStrike ? "line-through" : "none",
            "background-color": "#cce5ff"
          });
        } else {
          applyStyle("background-color", "#cce5ff");
          if (options.submittedStrike) {
            applyStyleMultiple({
              color: "gray",
              "text-decoration": "line-through"
            });
          }
        }
      } else if (deadlineDate < today) {
        // 마감 미제출 과제 표시 옵션
        if (options.showExpiredUnsubmitted) {
          applyStyleMultiple({
            color: "gray",
            "text-decoration": "line-through",
            "background-color": "#f0f0f0"
          });
        } else {
          row.style.display = "none";
        }
      } else if (diffDays >= 0 && diffDays <= 3) {
        applyStyle("background-color", "#ffcccc");
      }
    });
  }

  function updateCompletionPercentage() {
    const table = document.querySelector(".form_table table");
    if (!table) return;
    let totalStudents = null;
    let completedStudents = null;
    let completedCell = null;
    Array.from(table.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell) => {
        if (cell.tagName.toLowerCase() === "th" && cell.textContent.includes("총 수강생")) {
          const nextTd = cell.nextElementSibling;
          if (nextTd) {
            const totalText = nextTd.textContent.trim().replace("명", "");
            totalStudents = parseInt(totalText, 10);
          }
        }
        if (cell.tagName.toLowerCase() === "th" && cell.textContent.includes("제출완료 인원")) {
          const nextTd = cell.nextElementSibling;
          if (nextTd) {
            completedCell = nextTd;
            const completedText = nextTd.textContent.trim().replace("명", "");
            completedStudents = parseInt(completedText, 10);
          }
        }
      });
    });
    if (
      totalStudents !== null &&
      completedStudents !== null &&
      totalStudents > 0
    ) {
      const percentage = ((completedStudents / totalStudents) * 100).toFixed(1);
      if (completedCell) {
        completedCell.textContent = `${completedStudents}명 (${percentage}%)`;
      }
    }
  }

  function autoSelectTodayOfflineLecture() {
    var todayDay = new Date().getDate().toString();
    var calendarBox = document.getElementById("calendarBox");
    if (!calendarBox) return;
    var dayElem = calendarBox.querySelector('[data-day="' + todayDay + '"]');
    if (!dayElem) {
      var aElems = calendarBox.querySelectorAll("a");
      for (var i = 0; i < aElems.length; i++) {
        if (aElems[i].textContent.trim() === todayDay) {
          dayElem = aElems[i];
          break;
        }
      }
    }
    if (dayElem) {
      dayElem.click();
    }
  }

  // 메시지 리스너 추가
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "RELOAD_ASSIGNMENTS") {
    Object.assign(options, request.options);
    applyAssignmentList();
  }
});

// 스타일 충돌 방지를 위한 클래스 추가
function styleRows(table, className) {
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    row.className = className; /* 기존 inline style → CSS 클래스 사용 */
  });
}


  // 페이지별 적용
  if (document.querySelector(".table_basics_area")) {
    loadOptionsAndApply();
  }
  if (document.querySelector(".form_table table")) {
    updateCompletionPercentage();
  }
  if (
    window.location.href.indexOf("/dashboard/offline/lecture/index.do") !== -1
  ) {
    if (document.getElementById("calendarBox")) {
      autoSelectTodayOfflineLecture();
    }
  }
})();
