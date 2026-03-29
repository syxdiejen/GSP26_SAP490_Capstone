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
                const oFirstBody = aBodies.length > 0 ? aBodies[0] : null;

                return {
                  DbKey: oItem.DbKey,
                  TemplateId: oItem.TemplateId,
                  TemplateName: oItem.TemplateName,
                  Department: oItem.Department,
                  Category: oItem.Category,
                  IsActive: oItem.IsActive,
                  Subject: oItem.Subject,
                  CreatedBy: oItem.CreatedBy,
                  CreatedOn: oItem.CreatedOn,
                  BodyContent: oFirstBody ? oFirstBody.Content : "",
                  Language: oFirstBody ? oFirstBody.Language : "",
                  Version: oFirstBody ? oFirstBody.Version : "",
                  Variables:
                    oItem.to_Variables && oItem.to_Variables.results
                      ? oItem.to_Variables.results
                      : [],
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
          if (!sContent) {
            return "";
          }

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
        // 1. HÀM TẠO POPUP NHẬP EMAIL & CHỌN FILE
        onSendEmailPress: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          if (!oContext) {
            sap.m.MessageToast.show("Không tìm thấy dữ liệu Template!");
            return;
          }

          // Ô nhập Email người nhận (To)
          var oInputTo = new sap.m.Input({
            placeholder: "Nhập email người nhận (VD: khachhang@gmail.com)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });

          // Ô nhập Email người gửi (Reply-To / Sender Email)
          var oInputSender = new sap.m.Input({
            placeholder: "Nhập email người gửi (VD: cskh@congty.com)...",
            type: sap.m.InputType.Email,
            width: "100%",
            // Bạn có thể để trống hoặc lấy sẵn giá trị mặc định nếu muốn
            // value: oContext.getProperty("SenderEmail") || ""
          });

          var oSelectedFile = null;

          var oFileUploader = new FileUploader({
            width: "100%",
            placeholder: "Chọn file đính kèm (Tùy chọn)...",
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

                  // THÊM LABEL VÀ INPUT SENDER EMAIL VÀO POPUP
                  new sap.m.Label({
                    text: "Email người gửi (Reply-To):",
                  }).addStyleClass("sapUiSmallMarginTop"),
                  oInputSender,

                  new sap.m.Label({
                    text: "Đính kèm (Attachment):",
                  }).addStyleClass("sapUiSmallMarginTop"),
                  oFileUploader,
                ],
              }).addStyleClass("sapUiTinyMargin"),
            ],
            beginButton: new sap.m.Button({
              type: sap.m.ButtonType.Emphasized,
              text: "Send Email",
              press: function () {
                var sTargetEmail = oInputTo.getValue().trim();
                var sSenderEmail = oInputSender.getValue().trim(); // Lấy giá trị Sender Email

                if (!sTargetEmail) {
                  sap.m.MessageToast.show(
                    "Vui lòng nhập địa chỉ email người nhận!",
                  );
                  return;
                }

                oDialog.close();

                // Logic đọc file
                if (oSelectedFile) {
                  sap.ui.core.BusyIndicator.show(0);
                  var reader = new FileReader();

                  reader.onload = function (e) {
                    var sBase64Data = e.target.result;
                    this._executeSendEmail(
                      oContext,
                      sTargetEmail,
                      sSenderEmail, // Truyền thêm Sender Email xuống hàm dưới
                      oSelectedFile,
                      sBase64Data,
                    );
                  }.bind(this);

                  reader.onerror = function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("❌ Lỗi đọc file đính kèm!");
                  };

                  reader.readAsDataURL(oSelectedFile);
                } else {
                  // Truyền thêm Sender Email xuống hàm dưới
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

        // 2. HÀM THỰC THI GỌI API GOOGLE SCRIPT & GHI LOG
        _executeSendEmail: function (
          oContext,
          sTargetEmail,
          sSenderEmail, // Nhận biến Sender Email từ hàm trên
          oSelectedFile,
          sAttachmentBase64,
        ) {
          var sTemplateName = oContext.getProperty("TemplateName");
          var sBodyContent = oContext.getProperty("BodyContent") || "";
          var sSubject =
            oContext.getProperty("Subject") || "Gửi từ UI5 - " + sTemplateName;

          // Cập nhật Payload gửi sang Google Script
          var payload = {
            recipient: sTargetEmail,
            subject: sSubject,
            message: sBodyContent,
            replyTo: sSenderEmail, // Bắn cái Email Sender sang Google để làm Reply-To
            senderName: "Hệ thống SAP", // Tên hiển thị (Ngụy trang)
          };

          if (sAttachmentBase64 && oSelectedFile) {
            payload.attachmentBase64 = sAttachmentBase64;
            payload.attachmentName = oSelectedFile.name;
            payload.attachmentMime = oSelectedFile.type;
          }

          sap.ui.core.BusyIndicator.show(0);

          var GOOGLE_SCRIPT_URL =
            "https://script.google.com/macros/s/AKfycbyzEicAiHKKbsTe2_--9Rnb5GpGGLyVnmpWH43Jd5BdmZr6gJA9C4lfpovjEhnQ4TpA/exec";

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
                MessageToast.show("🎉 Đã gửi mail! Đang ghi Log...");

                var oModel = this.getOwnerComponent().getModel();

                // GHI LOG CÓ CHỨA SENDER EMAIL MỚI
                var oLogData = {
                  TemplateId: oContext.getProperty("TemplateId") || "",
                  Status: "O",
                  ObjKey: oContext.getProperty("ObjKey") || "",
                  ObjType: oContext.getProperty("ObjType") || "",
                  MimeType: oSelectedFile ? oSelectedFile.type : "",
                  FileName: oSelectedFile ? oSelectedFile.name : "",
                  SenderEmail: sSenderEmail, // Bắn giá trị nhập trên giao diện xuống OData
                };

                oModel.setUseBatch(false);

                oModel.create("/EmailLog", oLogData, {
                  success: function (oCreatedRecord) {
                    if (!oSelectedFile) {
                      console.log("Ghi log (không file) thành công!");
                      sap.m.MessageToast.show("Ghi Log thành công!");
                      oModel.refresh(true);
                      return;
                    }

                    var sRunId = oCreatedRecord.RunId;
                    var sEntityPath = oModel.createKey("/EmailLog", {
                      RunId: sRunId,
                    });
                    var sUploadUrl =
                      oModel.sServiceUrl + sEntityPath + "/$value";
                    var sToken = oModel.getSecurityToken();

                    $.ajax({
                      url: sUploadUrl,
                      type: "PUT",
                      data: oSelectedFile,
                      processData: false,
                      contentType: oSelectedFile.type,
                      headers: {
                        "x-csrf-token": sToken,
                        slug: oSelectedFile.name,
                        "If-Match": "*",
                      },
                      success: function () {
                        sap.m.MessageToast.show(
                          "Ghi Log & Upload file đính kèm thành công!",
                        );
                        oModel.refresh(true);
                      },
                      error: function (err) {
                        sap.m.MessageToast.show(
                          "⚠️ Ghi log OK nhưng Upload file thất bại!",
                        );
                      },
                    });
                  }.bind(this),
                  error: function (oError) {
                    sap.m.MessageToast.show(
                      "⚠️ Mail đã gửi nhưng lỗi ghi Log!",
                    );
                  },
                  completed: function () {
                    oModel.setUseBatch(true);
                  },
                });
              }
            })
            .catch(function (error) {
              sap.m.MessageToast.show("❌ Lỗi gọi API: " + error.message);
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
