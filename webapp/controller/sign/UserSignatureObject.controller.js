sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
  ],
  function (
    Controller,
    JSONModel,
    BusyIndicator,
    MessageBox,
    MessageToast,
    History,
  ) {
    "use strict";

    return Controller.extend(
      "zemail.template.app.controller.sign.UserSignatureObject",
      {
        onInit: function () {
          this.getView().setModel(
            new JSONModel({
              title: "Create Signature",
              isCreate: true,
            }),
            "viewState",
          );

          this.getOwnerComponent()
            .getRouter()
            .getRoute("signobject")
            .attachPatternMatched(this._onObjectMatched, this);

          this.getOwnerComponent()
            .getRouter()
            .getRoute("signcreate")
            .attachPatternMatched(this._onCreateMatched, this);
        },

        _onCreateMatched: function () {
          this.getView().unbindElement();

          this.getView().getModel("viewState").setData({
            title: "Create Signature",
            isCreate: true,
          });
        },

        _onObjectMatched: function (oEvent) {
          var oArgs = oEvent.getParameter("arguments");
          var sSignId = decodeURIComponent(oArgs.SignId || "");
          var bIsActiveEntity = oArgs.IsActiveEntity === "true";
          var oModel = this.getOwnerComponent().getModel();

          var sPath = oModel.createKey("/UserSignature", {
            SignId: sSignId,
            IsActiveEntity: bIsActiveEntity,
          });

          this.getView().bindElement({
            path: sPath,
            events: {
              dataRequested: function () {
                BusyIndicator.show(0);
              },
              dataReceived: function () {
                BusyIndicator.hide();
              },
            },
          });

          this.getView()
            .getModel("viewState")
            .setData({
              title: bIsActiveEntity ? "Display Signature" : "Edit Signature",
              isCreate: false,
            });
        },

        _validateBeforeSave: function (oPayload) {
          if (!oPayload.SignName) {
            MessageBox.warning("Vui lòng nhập tên chữ ký");
            return false;
          }

          if (!oPayload.Content) {
            MessageBox.warning("Vui lòng nhập nội dung chữ ký");
            return false;
          }

          return true;
        },

        _getPayloadFromView: function () {
          return {
            SignName: this.byId("inpSignName").getValue(),
            IsDefault: this.byId("swDefault").getState(),
            Content: this.byId("signatureEditor").getValue(),
          };
        },

        onSavePress: function () {
          var oModel = this.getOwnerComponent().getModel();
          var oViewState = this.getView().getModel("viewState");
          var bIsCreate = oViewState.getProperty("/isCreate");
          var oPayload = this._getPayloadFromView();
          var that = this;

          if (!this._validateBeforeSave(oPayload)) {
            return;
          }

          BusyIndicator.show(0);

          if (bIsCreate) {
            oModel.create("/UserSignature", oPayload, {
              success: function (oCreated) {
                BusyIndicator.hide();
                MessageToast.show("Đã lưu draft");

                that
                  .getOwnerComponent()
                  .getRouter()
                  .navTo(
                    "signobject",
                    {
                      SignId: encodeURIComponent(oCreated.SignId),
                      IsActiveEntity: "false",
                    },
                    true,
                  );
              },
              error: function (oError) {
                BusyIndicator.hide();
                that._showODataError(oError, "Lưu draft thất bại");
              },
            });
          } else {
            var oCtx = this.getView().getBindingContext();
            if (!oCtx) {
              BusyIndicator.hide();
              MessageBox.error("Không tìm thấy binding context.");
              return;
            }

            oModel.update(oCtx.getPath(), oPayload, {
              success: function () {
                BusyIndicator.hide();
                MessageToast.show("Đã cập nhật draft");
              },
              error: function (oError) {
                BusyIndicator.hide();
                that._showODataError(oError, "Cập nhật thất bại");
              },
            });
          }
        },

        onActivatePress: function () {
          var oModel = this.getOwnerComponent().getModel();
          var oViewState = this.getView().getModel("viewState");
          var bIsCreate = oViewState.getProperty("/isCreate");
          var oPayload = this._getPayloadFromView();
          var oRouter = this.getOwnerComponent().getRouter();
          var that = this;

          if (!this._validateBeforeSave(oPayload)) {
            return;
          }

          BusyIndicator.show(0);

          if (bIsCreate) {
            oModel.create("/UserSignature", oPayload, {
              success: function (oCreated) {
                oModel.callFunction("/UserSignatureActivate", {
                  method: "POST",
                  urlParameters: {
                    SignId: oCreated.SignId,
                    IsActiveEntity: false,
                  },
                  success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Publish thành công");
                    oRouter.navTo("signlist");
                  },
                  error: function (oError) {
                    BusyIndicator.hide();
                    that._showODataError(oError, "Publish thất bại");
                  },
                });
              },
              error: function (oError) {
                BusyIndicator.hide();
                that._showODataError(
                  oError,
                  "Không tạo được draft trước khi publish.",
                );
              },
            });
          } else {
            var oCtx = this.getView().getBindingContext();
            if (!oCtx) {
              BusyIndicator.hide();
              MessageBox.error("Không tìm thấy binding context.");
              return;
            }

            var oObj = oCtx.getObject();

            // nếu đang mở active entity thì phải tạo draft trước khi activate là sai logic
            // activate chỉ áp dụng cho draft
            if (oObj.IsActiveEntity === true) {
              BusyIndicator.hide();
              MessageBox.warning(
                "Bản ghi hiện tại là bản active. Hãy bấm Edit để tạo draft rồi mới Publish.",
              );
              return;
            }

            // lưu thay đổi draft trước rồi activate
            oModel.update(oCtx.getPath(), oPayload, {
              success: function () {
                oModel.callFunction("/UserSignatureActivate", {
                  method: "POST",
                  urlParameters: {
                    SignId: oObj.SignId,
                    IsActiveEntity: false,
                  },
                  success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Publish thành công");
                    oRouter.navTo("signlist");
                  },
                  error: function (oError) {
                    BusyIndicator.hide();
                    that._showODataError(oError, "Publish thất bại");
                  },
                });
              },
              error: function (oError) {
                BusyIndicator.hide();
                that._showODataError(
                  oError,
                  "Không lưu được draft trước khi publish.",
                );
              },
            });
          }
        },

        onDeletePress: function () {
          var oViewState = this.getView().getModel("viewState");
          var bIsCreate = oViewState.getProperty("/isCreate");
          var oModel = this.getOwnerComponent().getModel();
          var oRouter = this.getOwnerComponent().getRouter();
          var that = this;

          if (bIsCreate) {
            MessageToast.show("Chưa có draft để xóa");
            return;
          }

          var oCtx = this.getView().getBindingContext();
          if (!oCtx) {
            MessageBox.error("Không tìm thấy binding context.");
            return;
          }

          var oObj = oCtx.getObject();

          MessageBox.confirm("Bạn có chắc muốn xóa chữ ký này?", {
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }

              BusyIndicator.show(0);

              // draft -> xóa trực tiếp draft path
              if (oObj.IsActiveEntity === false) {
                oModel.callFunction("/UserSignatureDiscard", {
                  // Tên action discard trong metadata
                  method: "POST",
                  urlParameters: {
                    SignId: oObj.SignId,
                    IsActiveEntity: false,
                  },
                  success: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Đã hủy bỏ bản nháp (Discarded)");
                    that.getOwnerComponent().getRouter().navTo("signlist");
                  },
                  error: function (oError) {
                    BusyIndicator.hide();
                    that._showODataError(oError, "Không thể hủy bản nháp");
                  },
                });
                return;
              }

              // active entity -> frontend-only thì chỉ xóa active nếu backend cho phép
              oModel.remove(oCtx.getPath(), {
                success: function () {
                  BusyIndicator.hide();
                  MessageToast.show("Xóa thành công");
                  oRouter.navTo("signlist");
                },
                error: function (oError) {
                  BusyIndicator.hide();
                  that._showODataError(oError, "Xóa thất bại");
                },
              });
            },
          });
        },

        onCancelPress: function () {
          var oHistory = History.getInstance();
          var sPrevHash = oHistory.getPreviousHash();

          if (sPrevHash !== undefined) {
            window.history.go(-1);
          } else {
            this.getOwnerComponent().getRouter().navTo("signlist");
          }
        },

        onSignNameChange: function () {
          var bIsCreate = this.getView()
            .getModel("viewState")
            .getProperty("/isCreate");
          this.getView()
            .getModel("viewState")
            .setProperty(
              "/title",
              bIsCreate ? "Create Signature" : "Edit Signature",
            );
        },

        _showODataError: function (oError, sDefaultMsg) {
          var sMsg = sDefaultMsg || "Có lỗi xảy ra";

          if (oError && oError.responseText) {
            try {
              var oResp = JSON.parse(oError.responseText);
              sMsg =
                oResp &&
                oResp.error &&
                oResp.error.message &&
                oResp.error.message.value
                  ? oResp.error.message.value
                  : sMsg;
            } catch (e) {
              // ignore parse error
            }
          }

          MessageBox.error(sMsg);
        },
      },
    );
  },
);
