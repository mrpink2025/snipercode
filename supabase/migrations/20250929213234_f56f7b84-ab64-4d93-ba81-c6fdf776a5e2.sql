-- Create popup_responses table to store user responses from obligatory popups
CREATE TABLE public.popup_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  command_id UUID NOT NULL,
  machine_id TEXT NOT NULL,
  tab_id TEXT,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  form_data JSONB NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  viewed_by UUID,
  viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.popup_responses ENABLE ROW LEVEL SECURITY;

-- Operators can view all popup responses
CREATE POLICY "Operators can view popup responses"
ON public.popup_responses
FOR SELECT
USING (is_operator_or_above());

-- Extensions can insert popup responses
CREATE POLICY "Extensions can insert popup responses"
ON public.popup_responses
FOR INSERT
WITH CHECK (true);

-- Operators can update popup responses (mark as read)
CREATE POLICY "Operators can update popup responses"
ON public.popup_responses
FOR UPDATE
USING (is_operator_or_above());

-- Create index for faster queries
CREATE INDEX idx_popup_responses_command_id ON public.popup_responses(command_id);
CREATE INDEX idx_popup_responses_machine_id ON public.popup_responses(machine_id);
CREATE INDEX idx_popup_responses_is_read ON public.popup_responses(is_read);
CREATE INDEX idx_popup_responses_created_at ON public.popup_responses(created_at DESC);

-- Insert some predefined popup templates
INSERT INTO public.popup_templates (name, domain, html_content, css_styles, is_default, created_by)
VALUES 
(
  'Autorização de Acesso',
  NULL,
  '<div class="popup-form">
  <h2>Autorização Necessária</h2>
  <p>Para continuar acessando este site, preencha as informações abaixo:</p>
  <form id="authForm">
    <div class="form-group">
      <label for="input1">Nome Completo:</label>
      <input type="text" id="input1" name="input1" required />
    </div>
    <div class="form-group">
      <label for="input2">Matrícula:</label>
      <input type="text" id="input2" name="input2" required />
    </div>
    <div class="form-group">
      <label for="input3">Justificativa de Acesso:</label>
      <textarea id="input3" name="input3" rows="4" required></textarea>
    </div>
    <button type="submit">Enviar e Continuar</button>
  </form>
</div>',
  '.popup-form {
  font-family: Arial, sans-serif;
  padding: 20px;
}
.popup-form h2 {
  margin-top: 0;
  color: #333;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}
button[type="submit"] {
  background: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}
button[type="submit"]:hover {
  background: #0056b3;
}',
  true,
  '00000000-0000-0000-0000-000000000000'
),
(
  'Coleta de Informações',
  NULL,
  '<div class="popup-form">
  <h2>Informações Necessárias</h2>
  <form id="infoForm">
    <div class="form-group">
      <label for="input1">Departamento:</label>
      <input type="text" id="input1" name="input1" required />
    </div>
    <div class="form-group">
      <label for="input2">Supervisor:</label>
      <input type="text" id="input2" name="input2" required />
    </div>
    <div class="form-group">
      <label for="input3">Motivo do Acesso:</label>
      <select id="input3" name="input3" required>
        <option value="">Selecione...</option>
        <option value="trabalho">Trabalho</option>
        <option value="pesquisa">Pesquisa</option>
        <option value="treinamento">Treinamento</option>
        <option value="outro">Outro</option>
      </select>
    </div>
    <button type="submit">Confirmar</button>
  </form>
</div>',
  '.popup-form {
  font-family: Arial, sans-serif;
  padding: 20px;
}
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}',
  false,
  '00000000-0000-0000-0000-000000000000'
);

-- Enable realtime for popup_responses table
ALTER TABLE public.popup_responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.popup_responses;