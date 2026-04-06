sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/model/formatter",
    "sap/ui/unified/FileUploader",
  ],
  function (
    Controller,
    MessageToast,
    MessageBox,
    Filter,
    FilterOperator,
    JSONModel,
    formatter,
    FileUploader,
  ) {
    "use strict";

    return Controller.extend(
      "zemail.template.app.controller.template.EmailTemplateList",
      {
        formatter: formatter,

        onInit: function () {
          const oEmailModel = new JSONModel({
            EmailTemplates: [],
            AllEmailTemplates: [],
          });
          this.getView().setModel(oEmailModel, "email");
          this._loadTemplates();
        },

        _loadTemplates: function () {
          const oODataModel = this.getOwnerComponent().getModel();
          const oEmailModel = this.getView().getModel("email");
          const that = this;

          oODataModel.read("/Header", {
            urlParameters: {
              $expand: "to_Body,to_Variables",
              $format: "json",
              $orderby: "CreatedOn desc",
            },
            success: function (oData) {
              const aResults = oData.results || [];
              const aMapped = aResults.map(function (oItem) {
                const aBodies =
                  oItem.to_Body && oItem.to_Body.results
                    ? oItem.to_Body.results
                    : [];

                // 1. GOM TẤT CẢ CÁC DÒNG CỦA BODY LẠI THÀNH 1 CHUỖI LIỀN MẠCH
                let sFullContent = "";
                aBodies.forEach(function (oBody) {
                  sFullContent += oBody.Content + "\n";
                });

                // 2. TỰ ĐỘNG CẮT SUBJECT TỪ BODY NẾU CỘT SUBJECT BỊ TRỐNG
                let sSubject = oItem.Subject || "";
                if (!sSubject) {
                  sSubject = that._extractSubject(sFullContent);
                  // Bỏ đi cái chữ "Subject:..." trong phần ruột Body để thư đỡ bị lặp
                  sFullContent = sFullContent
                    .replace(/^Subject:.*$/m, "")
                    .trim();
                }

                return {
                  DbKey: oItem.DbKey,
                  TemplateId: oItem.TemplateId,
                  TemplateName: oItem.TemplateName,
                  Department: oItem.Department,
                  Category: oItem.Category,
                  IsActive: oItem.IsActive,
                  Subject: sSubject, // Tiêu đề đã được bóc tách
                  BodyContent: sFullContent, // Nội dung hoàn chỉnh
                  CreatedBy: oItem.CreatedBy,
                  CreatedOn: oItem.CreatedOn,
                };
              });

              oEmailModel.setProperty("/EmailTemplates", aMapped);
              oEmailModel.setProperty("/AllEmailTemplates", aMapped);
            },
            error: function () {
              MessageBox.error("Không tải được dữ liệu template từ backend.");
            },
          });
        },

        _extractSubject: function (sContent) {
          if (!sContent) return "";
          const aLines = sContent.split("\n");
          const sSubjectLine = aLines.find(function (sLine) {
            return sLine && sLine.trim().startsWith("Subject:");
          });
          if (sSubjectLine) {
            return sSubjectLine.replace("Subject:", "").trim();
          }
          return sContent.length > 80
            ? sContent.substring(0, 80) + "..."
            : sContent;
        },

        // ====================================================================
        // 1. HÀM TẠO POPUP GIAO DIỆN (Bật Multiple Files & Promise Read)
        // ====================================================================
        onSendEmailPress: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          if (!oContext) {
            sap.m.MessageToast.show("Không tìm thấy dữ liệu Template!");
            return;
          }

          var oInputTo = new sap.m.Input({
            placeholder: "Nhập email người nhận...",
            type: sap.m.InputType.Email,
            width: "100%",
          });
          var oInputCC = new sap.m.Input({
            placeholder: "Nhập email CC (Cách nhau dấu phẩy)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });
          var oInputBCC = new sap.m.Input({
            placeholder: "Nhập email BCC (Cách nhau dấu phẩy)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });
          var oInputSender = new sap.m.Input({
            placeholder: "Nhập email người gửi (Reply-To)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });

          var aSelectedFiles = []; // Mảng chứa các file user chọn

          var oFileUploader = new sap.ui.unified.FileUploader({
            width: "100%",
            placeholder: "Chọn một hoặc nhiều file đính kèm...",
            buttonText: "Browse...",
            multiple: true, // 🌟 BẬT TÍNH NĂNG CHỌN NHIỀU FILE
            change: function (e) {
              aSelectedFiles = e.getParameter("files");
            },
          });

          var oDialog = new sap.m.Dialog({
            title: "Xác nhận gửi Email",
            contentWidth: "400px",
            content: [
              new sap.m.VBox({
                items: [
                  new sap.m.Label({ text: "Gửi đến (To):", required: true }),
                  oInputTo,
                  new sap.m.Label({
                    text: "Đồng kính gửi (CC):",
                  }).addStyleClass("sapUiSmallMarginTop"),
                  oInputCC,
                  new sap.m.Label({ text: "Gửi ẩn danh (BCC):" }).addStyleClass(
                    "sapUiSmallMarginTop",
                  ),
                  oInputBCC,
                  new sap.m.Label({ text: "Email Reply-To:" }).addStyleClass(
                    "sapUiSmallMarginTop",
                  ),
                  oInputSender,
                  new sap.m.Label({ text: "Đính kèm:" }).addStyleClass(
                    "sapUiSmallMarginTop",
                  ),
                  oFileUploader,
                ],
              }).addStyleClass("sapUiTinyMargin"),
            ],
            beginButton: new sap.m.Button({
              type: sap.m.ButtonType.Emphasized,
              text: "Send Email",
              press: function () {
                var sTargetEmail = oInputTo.getValue().trim();
                var sSenderEmail = oInputSender.getValue().trim();
                var sCC = oInputCC.getValue().trim();
                var sBCC = oInputBCC.getValue().trim();
                // 🌟 KIỂM TRA VALIDATE EMAIL (Regex)
                if (!sTargetEmail) {
                  sap.m.MessageBox.warning(
                    "Vui lòng nhập email người nhận (TO)!",
                  );
                  return;
                }

                // Hàm check định dạng email (hỗ trợ nhiều email phẩy nhau)
                var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                var validateEmails = function (str) {
                  if (!str) return true; // Rỗng thì bỏ qua
                  var aMails = str.split(",");
                  return aMails.every(function (mail) {
                    return emailRegex.test(mail.trim());
                  });
                };

                if (
                  !validateEmails(sTargetEmail) ||
                  !validateEmails(sCC) ||
                  !validateEmails(sBCC) ||
                  (sSenderEmail && !validateEmails(sSenderEmail))
                ) {
                  sap.m.MessageBox.error(
                    "⚠️ Định dạng Email không hợp lệ! Vui lòng kiểm tra lại (chú ý dấu phẩy nếu có nhiều email).",
                  );
                  return;
                }
                oDialog.close();

                // 🌟 XỬ LÝ NHIỀU FILE VỚI PROMISE.ALL
                if (aSelectedFiles && aSelectedFiles.length > 0) {
                  sap.ui.core.BusyIndicator.show(0);
                  var aFilePromises = [];

                  Array.from(aSelectedFiles).forEach(function (file) {
                    var p = new Promise(function (resolve, reject) {
                      var reader = new FileReader();
                      reader.onload = function (e) {
                        var sBase64Data = e.target.result;
                        if (sBase64Data.indexOf(",") !== -1) {
                          sBase64Data = sBase64Data.split(",")[1];
                        }
                        resolve({
                          name: file.name,
                          mime: file.type,
                          base64: sBase64Data,
                          rawFile: file, // Giữ lại object file để upload OData Media
                        });
                      };
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                    aFilePromises.push(p);
                  });

                  Promise.all(aFilePromises)
                    .then(
                      function (aReadyFiles) {
                        this._executeSendEmail(
                          oContext,
                          sTargetEmail,
                          sCC,
                          sBCC,
                          sSenderEmail,
                          aReadyFiles,
                        );
                      }.bind(this),
                    )
                    .catch(function (err) {
                      sap.ui.core.BusyIndicator.hide();
                      sap.m.MessageBox.error("Lỗi đọc file đính kèm!");
                    });
                } else {
                  this._executeSendEmail(
                    oContext,
                    sTargetEmail,
                    sCC,
                    sBCC,
                    sSenderEmail,
                    [],
                  );
                }
              }.bind(this),
            }),
            endButton: new sap.m.Button({
              text: "Cancel",
              press: function () {
                oDialog.close();
              },
            }),
            afterClose: function () {
              oDialog.destroy();
            },
          });

          this.getView().addDependent(oDialog);
          oDialog.open();
        },

        // ====================================================================
        // 2. HÀM THỰC THI (Hỗ trợ Deep Insert + Upload Nhiều File Cùng Lúc)
        // ====================================================================
        _executeSendEmail: function (
          oContext,
          sTargetEmail,
          sCC,
          sBCC,
          sSenderEmail,
          aAttachments,
        ) {
          var oModel = this.getOwnerComponent().getModel();
          var sSubject = oContext.getProperty("Subject") || "No Subject";
          var sBodyContent = oContext.getProperty("BodyContent") || "";

          // --- ĐÓNG GÓI PAYLOAD GOOGLE ---
          var payload = {
            recipient: sTargetEmail,
            cc: sCC,
            bcc: sBCC,
            subject: sSubject,
            message: sBodyContent,
            replyTo: sSenderEmail,
            senderName: "Hệ thống SAP Fiori",
            attachments: [], // Chứa mảng file
          };

          if (aAttachments && aAttachments.length > 0) {
            payload.attachments = aAttachments.map(function (att) {
              return { name: att.name, mime: att.mime, base64: att.base64 };
            });
          }

          sap.ui.core.BusyIndicator.show(0);

          var GOOGLE_SCRIPT_URL =
            "https://script.google.com/macros/s/AKfycbwF1oYKUwjmRvdCiU0k_3B8LoClwKOXhLsypWpMmYxg0igATXfV3GA3t49X8fXR1xDthw/exec";

          // --- BẮN API GOOGLE ---
          fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
            redirect: "follow",
          })
            .then(function (response) {
              return response.text();
            })
            .then((resultText) => {
              if (resultText === "SUCCESS") {
                sap.m.MessageToast.show(
                  "🎉 Đã gửi mail thành công! Đang ghi Log...",
                );

                // --- 1. CHUẨN BỊ DATA CHO DETAILS (TO/CC/BCC) ---
                var aToEmails = sTargetEmail.split(",");
                var aCCEmails = sCC ? sCC.split(",") : [];
                var aBCCEmails = sBCC ? sBCC.split(",") : [];
                var aLogDetails = [];
                var iCounter = 1;

                aToEmails.forEach(function (email) {
                  if (email.trim())
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: "TO",
                    });
                });
                aCCEmails.forEach(function (email) {
                  if (email.trim())
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: "CC",
                    });
                });
                aBCCEmails.forEach(function (email) {
                  if (email.trim())
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: "BCC",
                    });
                });

                // --- 2. CHUẨN BỊ DATA CHO ATTACHMENT SHELLS (Tạo Vỏ File) ---
                var aLogAttachments = [];
                if (aAttachments && aAttachments.length > 0) {
                  aAttachments.forEach(function (att, index) {
                    aLogAttachments.push({
                      FileId: index + 1, // FileId là INT4 -> Phải là số, không được dùng String()
                      FileName: att.name,
                      MimeType: att.mime,
                    });
                  });
                }

                // --- 3. ĐÓNG GÓI DEEP INSERT ---
                var oLogData = {
                  TemplateId: oContext.getProperty("TemplateId") || "",
                  Status: "O",
                  SenderEmail: sSenderEmail,
                  to_Details: aLogDetails, // ⚠️ Đổi thành tên Navigation Property thực tế nối xuống bảng Detail
                  to_Attachments: aLogAttachments, // ⚠️ Đổi thành tên Navigation Property thực tế nối xuống bảng File
                };

                oModel.setUseBatch(false);

                // --- 4. GỌI LỆNH CREATE (TẠO HEADER + DETAIL + VỎ FILE) ---
                oModel.create("/EmailLog", oLogData, {
                  success: function (oCreatedRecord) {
                    if (!aAttachments || aAttachments.length === 0) {
                      sap.m.MessageToast.show("Ghi Log thành công!");
                      oModel.refresh(true);
                      sap.ui.core.BusyIndicator.hide();
                      return;
                    }

                    // --- 5. BƠM "RUỘT" FILE VÀO TỪNG CÁI VỎ VỪA TẠO (XẾP HÀNG TUẦN TỰ) ---
                    var sRunId = oCreatedRecord.RunId;

                    // Hàm upload tuần tự (Đệ quy)
                    var fnUploadSequentially = function (aFiles, iIndex) {
                      // Nếu đã duyệt hết mảng file -> Báo thành công
                      if (iIndex >= aFiles.length) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.success(
                          "🎉 Email đã gửi và Upload TOÀN BỘ file đính kèm xuống SAP thành công!",
                        );
                        oModel.refresh(true);
                        return;
                      }

                      var att = aFiles[iIndex];
                      var sEntityPath = oModel.createKey("/AttachmentLogs", {
                        RunId: sRunId,
                        FileId: iIndex + 1,
                      });
                      var sUploadUrl =
                        oModel.sServiceUrl + sEntityPath + "/$value";

                      // Thực hiện bắn AJAX cho 1 file
                      $.ajax({
                        url: sUploadUrl,
                        type: "PUT",
                        data: att.rawFile,
                        processData: false,
                        contentType: att.mime,
                        headers: {
                          "x-csrf-token": oModel.getSecurityToken(),
                          slug: att.name,
                          "If-Match": "*",
                        },
                        success: function () {
                          // Tải xong file này -> Gọi hàm này để tải file tiếp theo
                          fnUploadSequentially(aFiles, iIndex + 1);
                        },
                        error: function (err) {
                          sap.ui.core.BusyIndicator.hide();
                          sap.m.MessageBox.error(
                            "⚠️ Log đã ghi, nhưng bị kẹt ở File số " +
                              (iIndex + 1) +
                              ": " +
                              att.name,
                          );
                        },
                      });
                    };
                    fnUploadSequentially(aAttachments, 0);
                  },
                  error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show(
                      "⚠️ Mail đã gửi nhưng lỗi tạo Log!",
                    );
                  },
                  completed: function () {
                    oModel.setUseBatch(true);
                  },
                });
              } else {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Google Script Error: " + resultText);
              }
            })
            .catch(function (error) {
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageBox.error("❌ Lỗi gọi API: " + error.message);
            });
        },
        onItemPress: function (oEvent) {
          const oItem = oEvent.getSource();
          this._navToDetail(oItem.getBindingContext("email"));
        },

        onEditTemplate: function (oEvent) {
          const oContext = oEvent.getSource().getBindingContext("email");
          const oData = oContext.getObject();
          MessageToast.show("Edit template: " + oData.TemplateId);
        },

        onCreateEmail: function () {
          const oRouter = this.getOwnerComponent().getRouter();
          oRouter.navTo("templatecreate");
        },

        onCopyTemplate: function (oEvent) {
          const oContext = oEvent.getSource().getBindingContext("email");
          const oData = oContext.getObject();
          MessageToast.show("Copy template: " + oData.TemplateId);
        },

        onDeleteTemplate: function (oEvent) {
          const oContext = oEvent.getSource().getBindingContext("email");
          const oModel = this.getView().getModel("email");
          const sPath = oContext.getPath();
          const aTemplates = oModel.getProperty("/EmailTemplates").slice();

          MessageBox.confirm("Delete this template?", {
            onClose: function (sAction) {
              if (sAction === "OK") {
                const iIndex = parseInt(sPath.split("/").pop(), 10);
                aTemplates.splice(iIndex, 1);
                oModel.setProperty("/EmailTemplates", aTemplates);
                MessageToast.show("Template deleted");
              }
            },
          });
        },

        onToggleActive: function (oEvent) {
          const bState = oEvent.getParameter("state");
          const oContext = oEvent.getSource().getBindingContext("email");
          const oData = oContext.getObject();

          oData.IsActive = bState;
          oContext.getModel().refresh(true);

          MessageToast.show(
            "Template " +
              oData.TemplateId +
              " is now " +
              (bState ? "Active" : "Inactive"),
          );
        },

        onSearch: function (oEvent) {
          const sValue = (oEvent.getParameter("newValue") || "").toLowerCase();
          const oModel = this.getView().getModel("email");
          const aAll = oModel.getProperty("/AllEmailTemplates") || [];

          if (!sValue) {
            oModel.setProperty("/EmailTemplates", aAll);
            return;
          }

          const aFiltered = aAll.filter(function (oItem) {
            return (
              (oItem.TemplateName || "").toLowerCase().includes(sValue) ||
              (oItem.TemplateId || "").toLowerCase().includes(sValue) ||
              (oItem.Subject || "").toLowerCase().includes(sValue) ||
              (oItem.Category || "").toLowerCase().includes(sValue)
            );
          });

          oModel.setProperty("/EmailTemplates", aFiltered);
        },

        onCategoryChange: function (oEvent) {
          const sKey = oEvent.getParameter("selectedItem").getKey();
          const oModel = this.getView().getModel("email");
          const aAll = oModel.getProperty("/AllEmailTemplates") || [];

          if (sKey === "ALL") {
            oModel.setProperty("/EmailTemplates", aAll);
            return;
          }

          const aFiltered = aAll.filter(function (oItem) {
            return oItem.Category === sKey;
          });

          oModel.setProperty("/EmailTemplates", aFiltered);
        },

        _navToDetail: function (oContext) {
          const oRouter = this.getOwnerComponent().getRouter();
          const oData = oContext.getObject();

          oRouter.navTo("detail", {
            emailPath: window.encodeURIComponent(oData.DbKey),
          });
        },
      },
    );
  },
);
