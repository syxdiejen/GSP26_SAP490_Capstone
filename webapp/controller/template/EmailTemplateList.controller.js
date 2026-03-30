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

        onSendEmailPress: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          if (!oContext) {
            MessageToast.show("Không tìm thấy dữ liệu Template!");
            return;
          }

          var oInputTo = new sap.m.Input({
            placeholder: "Nhập email người nhận...",
            type: sap.m.InputType.Email,
            width: "100%",
          });

          var oInputSender = new sap.m.Input({
            placeholder: "Nhập email người gửi (Reply-To)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });

          var oSelectedFile = null;
          var oFileUploader = new FileUploader({
            width: "100%",
            placeholder: "Chọn file đính kèm...",
            buttonText: "Browse...",
            change: function (e) {
              var aFiles = e.getParameter("files");
              oSelectedFile = aFiles && aFiles.length > 0 ? aFiles[0] : null;
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
                  new sap.m.Label({ text: "Email người gửi:" }).addStyleClass(
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

                if (!sTargetEmail) {
                  MessageToast.show("Vui lòng nhập email người nhận!");
                  return;
                }
                oDialog.close();

                if (oSelectedFile) {
                  sap.ui.core.BusyIndicator.show(0);
                  var reader = new FileReader();
                  reader.onload = function (e) {
                    var sBase64Data = e.target.result;
                    // Bỏ đi vỏ bọc data:image/png;base64, để lấy ruột
                    if (sBase64Data.indexOf(",") !== -1) {
                      sBase64Data = sBase64Data.split(",")[1];
                    }
                    this._executeSendEmail(
                      oContext,
                      sTargetEmail,
                      sSenderEmail,
                      oSelectedFile,
                      sBase64Data,
                    );
                  }.bind(this);
                  reader.readAsDataURL(oSelectedFile);
                } else {
                  this._executeSendEmail(
                    oContext,
                    sTargetEmail,
                    sSenderEmail,
                    null,
                    null,
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

        _executeSendEmail: function (
          oContext,
          sTargetEmail,
          sSenderEmail,
          oSelectedFile,
          sAttachmentBase64,
        ) {
          var oModel = this.getOwnerComponent().getModel();

          // Lấy Subject và Body nguyên thủy
          var sSubject = oContext.getProperty("Subject") || "No Subject";
          var sBodyContent = oContext.getProperty("BodyContent") || "";

          // BỘ MÁY XỬ LÝ BIẾN BẰNG JAVASCRIPT
          var aVariables = {
            VENDOR_NAME: "Công ty Cổ phần ABC",
            PO_NUMBER: "PO-2026-0329",
            ORDER_DATE: "29/03/2026",
            SENDER_NAME: "Phòng Mua Hàng",
          };

          for (var key in aVariables) {
            // Hỗ trợ cả {BIẾN} và {{BIẾN}}
            var regex1 = new RegExp("{" + key + "}", "g");
            var regex2 = new RegExp("{{" + key + "}}", "g");
            sSubject = sSubject
              .replace(regex1, aVariables[key])
              .replace(regex2, aVariables[key]);
            sBodyContent = sBodyContent
              .replace(regex1, aVariables[key])
              .replace(regex2, aVariables[key]);
          }

          // CHUẨN BỊ PAYLOAD BẮN GOOGLE
          var payload = {
            recipient: sTargetEmail,
            subject: sSubject,
            message: sBodyContent,
            replyTo: sSenderEmail,
            senderName: "Hệ thống SAP Fiori",
          };

          if (sAttachmentBase64 && oSelectedFile) {
            payload.attachmentBase64 = sAttachmentBase64;
            payload.attachmentName = oSelectedFile.name;
            payload.attachmentMime = oSelectedFile.type;
          }

          sap.ui.core.BusyIndicator.show(0);
          var GOOGLE_SCRIPT_URL =
            "https://script.google.com/macros/s/AKfycbyzEicAiHKKbsTe2_--9Rnb5GpGGLyVnmpWH43Jd5BdmZr6gJA9C4lfpovjEhnQ4TpA/exec";

          // GỌI GOOGLE API
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
                MessageToast.show("🎉 Đã gửi mail thành công! Đang ghi Log...");

                // TỰ ĐỘNG GHI LOG VÀO ODATA
                var oLogData = {
                  TemplateId: oContext.getProperty("TemplateId") || "",
                  Status: "O",
                  SenderEmail: sSenderEmail,
                  FileName: oSelectedFile ? oSelectedFile.name : "",
                };

                oModel.setUseBatch(false);
                // BƯỚC 1: TẠO DÒNG LOG (HEADER)
                oModel.create("/EmailLog", oLogData, {
                  success: function (oCreatedRecord) {
                    // Nếu người dùng KHÔNG đính kèm file thì dừng ở đây là xong
                    if (!oSelectedFile) {
                      MessageToast.show("Ghi Log thành công!");
                      oModel.refresh(true);
                      return;
                    }

                    // BƯỚC 2: NẾU CÓ FILE -> GỌI AJAX 'PUT' ĐỂ NHÉT FILE VÀO DÒNG LOG VỪA TẠO
                    // Lấy khóa chính (RunId) do SAP tự sinh ra trả về
                    var sRunId = oCreatedRecord.RunId;
                    var sEntityPath = oModel.createKey("/EmailLog", {
                      RunId: sRunId,
                    });
                    var sUploadUrl =
                      oModel.sServiceUrl + sEntityPath + "/$value"; // Cổng upload file của OData
                    var sToken = oModel.getSecurityToken();

                    $.ajax({
                      url: sUploadUrl,
                      type: "PUT",
                      data: oSelectedFile, // Truyền nguyên cái file vật lý
                      processData: false,
                      contentType: oSelectedFile.type,
                      headers: {
                        "x-csrf-token": sToken,
                        slug: oSelectedFile.name, // Truyền tên file cho SAP biết
                        "If-Match": "*", // Kim bài vượt ải ETag
                      },
                      success: function () {
                        sap.m.MessageToast.show(
                          "🎉 Ghi Log & Upload file đính kèm thành công!",
                        );
                        oModel.refresh(true);
                      },
                      error: function (err) {
                        sap.m.MessageBox.error(
                          "⚠️ Ghi log OK nhưng Upload file thất bại!",
                        );
                      },
                    });
                  },
                  error: function () {
                    sap.m.MessageToast.show(
                      "⚠️ Mail đã gửi nhưng lỗi tạo dòng Log!",
                    );
                  },
                  completed: function () {
                    oModel.setUseBatch(true);
                  },
                });
              } else {
                MessageBox.error("Google Script Error: " + resultText);
              }
            })
            .catch(function (error) {
              MessageBox.error("❌ Lỗi gọi API: " + error.message);
            })
            .finally(function () {
              sap.ui.core.BusyIndicator.hide();
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
